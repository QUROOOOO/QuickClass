"""Usage accounting + budget enforcement.

The backend is authoritative: every model invocation is recorded here,
never trusted from the frontend. A process-local lock guards the
check-then-reserve step so concurrent agent/task runs cannot both slip
past a budget limit between the check and the record (a real gap in a
naive "check usage, then call, then record" flow).

Note on scope: the lock is process-local (Python `threading.Lock`), which
is correct for this single-process dev server. A multi-process/multi-node
deployment would need a distributed lock (e.g. Redis) behind the same
`reserve`/`finalize`/`release` interface — the interface is intentionally
shaped so that swap is drop-in.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from app.domain.usage import (
    BudgetConfig,
    BudgetMode,
    BudgetPauseRecord,
    BudgetPeriod,
    UsageRecord,
    UsageStatus,
)
from app.persistence.store import Store

_DAY = 86400.0
_MONTH = 30 * _DAY


@dataclass
class Reservation:
    id: str
    project_id: str
    tokens: float
    cost: float


@dataclass
class BudgetCheck:
    allowed: bool
    mode: BudgetMode
    limit: float
    used: float
    reserved: float
    remaining: float
    reservation: Reservation | None = None


class UsageService:
    def __init__(self, store: Store) -> None:
        self.store = store
        self._lock = threading.Lock()
        self._reservations: dict[str, Reservation] = {}
        self._reservation_seq = 0

    # ---- budget config -----------------------------------------------
    def set_budget(self, config: BudgetConfig) -> BudgetConfig:
        self.store.put("budget_configs", config.project_id, config.model_dump(mode="json"))
        return config

    def get_budget(self, project_id: str) -> BudgetConfig:
        data = self.store.get("budget_configs", project_id)
        return BudgetConfig(**data) if data else BudgetConfig(project_id=project_id)

    # ---- ledger --------------------------------------------------------
    def _records(self, project_id: str) -> list[UsageRecord]:
        return [UsageRecord(**d) for d in self.store.list("usage_records") if d.get("project_id") == project_id]

    def _period_window(self, period: BudgetPeriod) -> float:
        now = time.time()
        if period == BudgetPeriod.DAILY:
            return now - _DAY
        if period == BudgetPeriod.MONTHLY:
            return now - _MONTH
        return 0.0  # per_project / per_run — full history / not-time-windowed

    def usage_in_period(self, project_id: str, period: BudgetPeriod) -> tuple[int, float]:
        cutoff = self._period_window(period)
        records = [r for r in self._records(project_id) if r.timestamp >= cutoff and r.status == UsageStatus.OK]
        tokens = sum(r.total_tokens for r in records)
        cost = sum(r.cost or 0.0 for r in records)
        return tokens, cost

    def summary(self, project_id: str) -> dict:
        cfg = self.get_budget(project_id)
        tokens, cost = self.usage_in_period(project_id, cfg.period)
        reserved = sum(r.tokens if cfg.mode == BudgetMode.TOKENS else r.cost for r in self._reservations.values() if r.project_id == project_id)
        used = tokens if cfg.mode == BudgetMode.TOKENS else cost
        limit = (cfg.limit_tokens or 0) if cfg.mode == BudgetMode.TOKENS else (cfg.limit_cost or 0.0)
        return {
            "mode": cfg.mode.value,
            "period": cfg.period.value,
            "limit": limit,
            "used": used,
            "reserved": reserved,
            "remaining": max(0.0, limit - used - reserved) if cfg.mode != BudgetMode.DISABLED else None,
        }

    # ---- reservation (race-safe check-before-call) ---------------------
    def check_and_reserve(self, project_id: str, estimated_tokens: int, estimated_cost: float) -> BudgetCheck:
        with self._lock:
            cfg = self.get_budget(project_id)
            if cfg.mode == BudgetMode.DISABLED:
                return BudgetCheck(True, cfg.mode, 0, 0, 0, float("inf"))

            tokens, cost = self.usage_in_period(project_id, cfg.period)
            reserved_tokens = sum(r.tokens for r in self._reservations.values() if r.project_id == project_id)
            reserved_cost = sum(r.cost for r in self._reservations.values() if r.project_id == project_id)

            if cfg.mode == BudgetMode.TOKENS:
                limit = cfg.limit_tokens or 0
                used = tokens + reserved_tokens
                would_use = estimated_tokens
            else:
                limit = cfg.limit_cost or 0.0
                used = cost + reserved_cost
                would_use = estimated_cost

            remaining = limit - used
            if would_use > remaining:
                return BudgetCheck(False, cfg.mode, limit, used, would_use, max(0.0, remaining))

            self._reservation_seq += 1
            res = Reservation(f"res_{self._reservation_seq}", project_id, estimated_tokens, estimated_cost)
            self._reservations[res.id] = res
            return BudgetCheck(True, cfg.mode, limit, used, would_use, remaining - would_use, res)

    def finalize_reservation(self, reservation: Reservation | None, record: UsageRecord) -> UsageRecord:
        with self._lock:
            if reservation is not None:
                self._reservations.pop(reservation.id, None)
            self.store.put("usage_records", record.id, record.model_dump(mode="json"))
        return record

    def release_reservation(self, reservation: Reservation | None) -> None:
        with self._lock:
            if reservation is not None:
                self._reservations.pop(reservation.id, None)

    # ---- pause / resume --------------------------------------------------
    def create_pause(self, **kwargs) -> BudgetPauseRecord:
        rec = BudgetPauseRecord(**kwargs)
        self.store.put("budget_pauses", rec.id, rec.model_dump(mode="json"))
        return rec

    def get_active_pause(self, project_id: str) -> BudgetPauseRecord | None:
        candidates = [
            BudgetPauseRecord(**d)
            for d in self.store.list("budget_pauses")
            if d.get("project_id") == project_id and not d.get("resolved")
        ]
        return max(candidates, key=lambda r: r.created_at) if candidates else None

    def resolve_pause(self, pause_id: str) -> None:
        data = self.store.get("budget_pauses", pause_id)
        if data:
            data["resolved"] = True
            self.store.put("budget_pauses", pause_id, data)
