"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { IconMonitor, IconSunlight, IconCrescent, IconCheck, IconClose } from "@/components/ui/Icon";
import { api, type ApiCredential, type BudgetConfig, type BudgetMode, type Provider, type UsageSummary, type ToolWithConnection, type PermissionRisk } from "@/lib/api";

type SectionId = "account" | "appearance" | "apiUsage" | "tools" | "security";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "apiUsage", label: "API & Usage" },
  { id: "tools", label: "Connected Tools" },
  { id: "security", label: "Security" },
];

const BUDGET_SCOPE = "_global"; // global default until per-project budgets are surfaced in the UI

const PROVIDERS: Provider[] = ["gemini", "openai", "anthropic", "openrouter", "custom"];

/** Real, server-backed API key management. The raw key is never returned by the backend. */
function ApiUsageSection() {
  const [keys, setKeys] = useState<ApiCredential[]>([]);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [rawKey, setRawKey] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budget, setBudgetState] = useState<BudgetConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [k, b, u] = await Promise.all([api.listApiKeys(), api.getBudget(BUDGET_SCOPE), api.getUsage(BUDGET_SCOPE)]);
      setKeys(k);
      setBudgetState(b);
      setUsage(u.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API & usage settings");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addKey = async () => {
    if (!rawKey.trim()) return;
    setBusy(true);
    try {
      await api.saveApiKey(provider, rawKey.trim(), label.trim());
      setRawKey("");
      setLabel("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the key");
    } finally {
      setBusy(false);
    }
  };

  const test = async (id: string) => {
    setBusy(true);
    try {
      await api.testApiKey(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.removeApiKey(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveBudget = async (patch: Partial<BudgetConfig>) => {
    const next = { ...(budget ?? { project_id: BUDGET_SCOPE, mode: "disabled" as BudgetMode, limit_tokens: null, limit_cost: null, period: "per_project" as const }), ...patch };
    setBudgetState(next as BudgetConfig);
    await api.setBudget(BUDGET_SCOPE, next);
    await refresh();
  };

  return (
    <div className="space-y-5">
      <Section title="Provider API keys">
        {error && <p className="text-[12.5px] text-error mb-3">{error}</p>}
        <div className="space-y-2 mb-5">
          {keys.length === 0 && (
            <p className="text-[13px] text-text-secondary">No keys saved. Add one below to enable real model calls.</p>
          )}
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 rounded-control bg-ink-soft">
              <span className="label-caps text-text-faint w-16 shrink-0">{k.provider}</span>
              <span className="data-text text-text-secondary flex-1 min-w-[100px] truncate">{k.masked_key}</span>
              <span
                className={`label-micro !text-[10px] px-1.5 py-0.5 rounded-full ${
                  k.status === "verified"
                    ? "text-success bg-success/10"
                    : k.status === "invalid"
                      ? "text-error bg-error/10"
                      : "text-text-faint bg-ink-soft-strong"
                }`}
              >
                {k.status}
              </span>
              <button className="control text-[11.5px] text-text-secondary hover:text-text-primary px-2 py-1" onClick={() => test(k.id)} disabled={busy}>
                Test
              </button>
              <button
                aria-label={`Remove ${k.provider} key`}
                className="icon-button !w-6 !h-6"
                onClick={() => remove(k.id)}
                disabled={busy}
              >
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[140px_1fr_1fr_auto] gap-2.5 items-center">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="control min-w-0 w-full bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-[12.5px] text-text-primary"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="password"
            value={rawKey}
            onChange={(e) => setRawKey(e.target.value)}
            placeholder="API key"
            className="control min-w-0 w-full bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-faint"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="control min-w-0 w-full sm:col-span-2 lg:col-span-1 bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-faint"
          />
          <Button size="sm" onClick={addKey} disabled={busy || !rawKey.trim()} className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto justify-center">
            Save
          </Button>
        </div>
        <p className="text-[11.5px] text-text-faint mt-2">
          Keys are stored server-side, never shown again in full, and never logged. "Test" checks the key's
          format only — this environment cannot make live network calls to verify connectivity.
        </p>
      </Section>

      <Section title="Usage limit">
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="text-[12.5px] flex-1 min-w-[160px]">
            <span className="label-caps text-text-secondary block mb-1.5">Limit type</span>
            <select
              value={budget?.mode ?? "disabled"}
              onChange={(e) => void saveBudget({ mode: e.target.value as BudgetMode })}
              className="control w-full bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-text-primary"
            >
              <option value="disabled">Disabled</option>
              <option value="tokens">Token limit</option>
              <option value="cost">Cost limit</option>
            </select>
          </label>
          {budget?.mode === "tokens" && (
            <label className="text-[12.5px] flex-1 min-w-[160px]">
              <span className="label-caps text-text-secondary block mb-1.5">Token limit</span>
              <input
                type="number"
                min={1}
                value={budget?.limit_tokens ?? ""}
                onChange={(e) => void saveBudget({ limit_tokens: Number(e.target.value) || null })}
                className="control w-full bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-text-primary"
              />
            </label>
          )}
          {budget?.mode === "cost" && (
            <label className="text-[12.5px] flex-1 min-w-[160px]">
              <span className="label-caps text-text-secondary block mb-1.5">Cost limit (USD)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={budget?.limit_cost ?? ""}
                onChange={(e) => void saveBudget({ limit_cost: Number(e.target.value) || null })}
                className="control w-full bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-text-primary"
              />
            </label>
          )}
          {budget && budget.mode !== "disabled" && (
            <label className="text-[12.5px] flex-1 min-w-[160px]">
              <span className="label-caps text-text-secondary block mb-1.5">Period</span>
              <select
                value={budget.period}
                onChange={(e) => void saveBudget({ period: e.target.value as BudgetConfig["period"] })}
                className="control w-full bg-surface-secondary border border-border rounded-control px-2.5 py-2 text-text-primary"
              >
                <option value="per_run">Per run</option>
                <option value="per_project">Per project</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          )}
        </div>

        {usage && usage.mode !== "disabled" && (
          <div className="flex items-center gap-4 px-3 py-2.5 rounded-control bg-ink-soft text-[12.5px]">
            <span className="text-text-secondary">
              Used <span className="text-text-primary font-medium">{usage.used.toFixed(usage.mode === "cost" ? 2 : 0)}</span> / {usage.limit}
            </span>
            <span className="text-text-faint">·</span>
            <span className="text-text-secondary">
              Remaining <span className="text-text-primary font-medium">{usage.remaining?.toFixed(usage.mode === "cost" ? 2 : 0) ?? "—"}</span>
            </span>
          </div>
        )}
        <p className="text-[11.5px] text-text-faint mt-3">
          Usage is tracked server-side from actual agent runs — never estimated in the browser. When a run's
          runtime does not report real token counts (e.g. the local plan-only runtime), a documented per-task
          estimate is recorded instead of pretending exact accounting.
        </p>
      </Section>
    </div>
  );
}

const RISK_TONE: Record<PermissionRisk, string> = {
  low: "text-text-secondary bg-ink-soft",
  medium: "text-warning bg-warning/10",
  high: "text-error bg-error/10",
  critical: "text-error bg-error/15 font-semibold",
};

const STATUS_TONE: Record<string, string> = {
  connected: "text-success bg-success/10",
  disconnected: "text-text-faint bg-ink-soft",
  disabled: "text-text-faint bg-ink-soft",
  error: "text-error bg-error/10",
  requires_authentication: "text-warning bg-warning/10",
};

/** Real Connected Tools — every status here reflects an actual local check
 *  or an honest "requires_authentication" for tools this build does not
 *  yet have credentials for. Nothing here is decorative. */
function ConnectedToolsSection() {
  const [tools, setTools] = useState<ToolWithConnection[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTools(await api.listTools());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connected tools");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Connected Tools">
      {error && <p className="text-[12.5px] text-error mb-3">{error}</p>}
      <p className="text-[13px] text-text-secondary mb-4">
        Tools the agent can actually use during a build. Status reflects a real local check — nothing here is
        simulated. Tools that need external credentials (GitHub, Database, Deployment, Browser, MCP) honestly
        show "requires authentication" until that integration is configured.
      </p>
      <div className="space-y-2">
        {tools.map((t) => {
          const isOpen = expanded === t.id;
          const c = t.connection;
          return (
            <div key={t.id} className="rounded-control border border-border overflow-hidden">
              <button
                className="control w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left hover:bg-ink-soft"
                onClick={() => setExpanded(isOpen ? null : t.id)}
                aria-expanded={isOpen}
              >
                <span className="text-[13.5px] font-medium text-text-primary">{t.name}</span>
                <span className="label-micro !text-[10px] px-1.5 py-0.5 rounded-full bg-ink-soft text-text-faint">{t.type}</span>
                <span className={`label-micro !text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_TONE[c.status] ?? "bg-ink-soft"}`}>
                  {c.status.replace("_", " ")}
                </span>
                {c.enabled && <span className="label-micro !text-[10px] px-1.5 py-0.5 rounded-full text-success bg-success/10">enabled</span>}
                <span className="ml-auto text-[11.5px] text-text-faint">{isOpen ? "Hide" : "Details"}</span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <p className="text-[12.5px] text-text-secondary mb-3">{t.description}</p>

                  {t.capabilities.length > 0 && (
                    <div className="mb-3">
                      <p className="label-caps text-text-faint mb-1.5">Capabilities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.capabilities.map((cap) => (
                          <span key={cap} className="data-text !text-[11px] px-2 py-0.5 rounded-full bg-ink-soft text-text-secondary">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <p className="label-caps text-text-faint mb-1.5">Permissions</p>
                    <div className="space-y-1">
                      {t.permissions.map((p) => (
                        <div key={p.name} className="flex items-center gap-2 text-[12px]">
                          <span className="data-text text-text-secondary">{p.name}</span>
                          <span className={`label-micro !text-[9.5px] px-1.5 py-0.5 rounded-full ${RISK_TONE[p.risk]}`}>{p.risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {c.error && <p className="text-[11.5px] text-error mb-3">{c.error}</p>}
                  <p className="text-[11px] text-text-faint mb-3">
                    {c.last_health_check ? `Last checked ${new Date(c.last_health_check * 1000).toLocaleTimeString()}` : "Never checked"}
                    {c.last_latency_ms != null ? ` · ${c.last_latency_ms.toFixed(1)}ms` : ""}
                    {c.last_used ? ` · last used ${new Date(c.last_used * 1000).toLocaleTimeString()}` : ""}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="control text-[11.5px] text-text-secondary hover:text-text-primary border border-border rounded-control px-2.5 py-1.5 disabled:opacity-50"
                      onClick={() => act(t.id, () => api.testTool(t.id))}
                      disabled={busy === t.id}
                    >
                      Test
                    </button>
                    {c.status === "connected" ? (
                      <>
                        <button
                          className="control text-[11.5px] text-text-secondary hover:text-text-primary border border-border rounded-control px-2.5 py-1.5 disabled:opacity-50"
                          onClick={() => act(t.id, () => (c.enabled ? api.disableTool(t.id) : api.enableTool(t.id)))}
                          disabled={busy === t.id}
                        >
                          {c.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="control text-[11.5px] text-text-secondary hover:text-text-primary border border-border rounded-control px-2.5 py-1.5 disabled:opacity-50"
                          onClick={() => act(t.id, () => api.disconnectTool(t.id))}
                          disabled={busy === t.id}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        className="control text-[11.5px] text-text-primary bg-ink-soft-strong rounded-control px-2.5 py-1.5 disabled:opacity-50"
                        onClick={() => act(t.id, () => api.connectTool(t.id))}
                        disabled={busy === t.id}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-primary p-6">
      <h2 className="display text-[16px] tracking-tight mb-5">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer">
      <span>
        <span className="block text-[13.5px] text-text-primary">{label}</span>
        {hint && <span className="block text-[12px] text-text-secondary mt-0.5">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-ink" : "bg-border-strong"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
            value ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function SettingsView() {
  const { theme, setTheme, resolved, reduceMotion, setReduceMotion, reduceTransparency, setReduceTransparency } =
    useTheme();
  const { user, adapter } = useAuth();
  const [section, setSection] = useState<SectionId>("appearance");

  const themes: { id: "system" | "light" | "dark"; label: string; icon: React.ReactNode }[] = [
    { id: "system", label: "SYSTEM", icon: <IconMonitor size={14} className="text-text-secondary" /> },
    { id: "light", label: "BRIGHT", icon: <IconSunlight size={14} className="text-text-secondary" /> },
    { id: "dark", label: "DARK", icon: <IconCrescent size={14} className="text-text-secondary" /> },
  ];

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <h1 className="display text-display-xl">Settings</h1>
        <p className="mt-2 text-[13.5px] text-text-secondary">A small set of real controls.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav aria-label="Settings sections" className="md:w-44 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-current={section === s.id ? "true" : undefined}
                className={`control shrink-0 px-3 py-2 rounded-control text-[13px] text-left
                  ${
                    section === s.id
                      ? "bg-ink-soft text-text-primary font-medium"
                      : "text-text-secondary hover:bg-surface-secondary"
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 space-y-5">
          {section === "account" && (
            <Section title="Account">
              {user ? (
                <div>
                  <div className="flex items-center gap-4 mb-5">
                    <span className="w-11 h-11 grid place-items-center rounded-full bg-ink-soft text-text-primary text-[15px] font-semibold">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-[14.5px] font-semibold text-text-primary">{user.name}</p>
                      <p className="text-[12.5px] text-text-secondary">{user.email}</p>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <Button
                      size="md"
                      variant="danger"
                      onClick={async () => {
                        await adapter.signOut();
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[13.5px] text-text-secondary mb-4">
                    You're browsing as a guest. Sign in to keep your projects across devices.
                  </p>
                  <div className="flex gap-2">
                    <a href="/login">
                      <Button size="md">Sign in</Button>
                    </a>
                    <a href="/signup">
                      <Button size="md" variant="secondary">
                        Create account
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </Section>
          )}

          {section === "appearance" && (
            <Section title="Appearance">
              <h3 className="label-caps text-text-secondary mb-3">Theme</h3>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3 mb-8">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={theme === t.id}
                    onClick={() => setTheme(t.id)}
                    className={`control flex flex-col items-center gap-2.5 px-4 py-5 rounded-card border text-[13px] transition-colors
                      ${
                        theme === t.id
                          ? "border-border-strong bg-surface-secondary text-text-primary"
                          : "border-border bg-surface-secondary/50 text-text-secondary hover:border-border-strong"
                      }`}
                  >
                    <span className="grid place-items-center w-10 h-10 rounded-control bg-surface-elevated shadow-rest">
                      {t.icon}
                    </span>
                    {t.label}
                    {theme === t.id && <IconCheck size={13} className="text-text-primary" />}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-text-faint mb-8">
                {theme === "system"
                  ? "Following your system. Currently " + resolved + "."
                  : `Fixed to ${theme}.`}
              </p>

              <h3 className="label-caps text-text-secondary mb-2">Preferences</h3>
              <div className="border-t border-border divide-y divide-border">
                <Toggle
                  label="Reduce motion"
                  hint="Calm the interface — fewer animations, no drifting field."
                  value={reduceMotion}
                  onChange={setReduceMotion}
                />
                <Toggle
                  label="Reduce transparency"
                  hint="Solid surfaces instead of frosted glass."
                  value={reduceTransparency}
                  onChange={setReduceTransparency}
                />
              </div>
            </Section>
          )}

          {section === "apiUsage" && <ApiUsageSection />}

          {section === "tools" && <ConnectedToolsSection />}

          {section === "security" && (
            <Section title="Security">
              {adapter.configured ? (
                <p className="text-[13.5px] text-text-secondary mb-3">
                  Connected to the Code Butler identity service. Sessions are
                  authenticated end to end.
                </p>
              ) : (
                <p className="text-[13.5px] text-text-secondary mb-3">
                  Authentication is currently running on a local demo provider. Connecting
                  the backend (Firebase-ready) enables real sessions and password resets.
                </p>
              )}
              <p className="text-[12px] text-text-faint data-text">
                provider: {adapter.configured ? "backend" : "demo"} · configured:{" "}
                {String(adapter.configured)}
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}