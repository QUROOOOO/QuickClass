"use client";

import { useEffect, useRef } from "react";

/**
 * COMPUTATIONAL FIELD — the auth-page atmosphere.
 *
 * Distinct from the homepage PixelField: this is a sparse mesh of
 * drifting nodes connected by thin lines, with a handful of nodes
 * rendered as small computational glyphs (· + ○ □ × /) instead of
 * plain dots. Two depth layers drift at different speeds for a
 * subtle parallax read. The pointer locally distorts nearby nodes;
 * they spring back once it moves on.
 *
 * Form state (idle/focus/typing/submit/success/error) is pushed in
 * imperatively via `setAuthFieldState` — no React context needed for
 * a canvas-only effect. The auth form remains the visual priority;
 * the field only ever responds subtly.
 */

export type AuthFieldState = "idle" | "focus" | "typing" | "submit" | "success" | "error";

let currentState: AuthFieldState = "idle";
const listeners = new Set<(s: AuthFieldState) => void>();

export function setAuthFieldState(state: AuthFieldState) {
  currentState = state;
  listeners.forEach((l) => l(state));
}

const GLYPHS = ["·", "+", "○", "□", "×", "/"];

interface Node {
  bx: number;
  by: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  layer: 0 | 1; // 0 = background (slow, faint), 1 = foreground (responsive)
  glyph: string | null;
  phase: number;
}

const MODE: Record<AuthFieldState, { drift: number; alpha: number; jitter: number }> = {
  idle: { drift: 1, alpha: 1, jitter: 0 },
  focus: { drift: 0.7, alpha: 1.15, jitter: 0 },
  typing: { drift: 0.9, alpha: 1.2, jitter: 0.15 },
  submit: { drift: 1.6, alpha: 1.3, jitter: 0 },
  success: { drift: 0.3, alpha: 0.85, jitter: 0 },
  error: { drift: 1, alpha: 1.1, jitter: 0.9 },
};

export function ComputationalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("motion-reduced");

    let w = 0;
    let h = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let running = true;
    let rgb: [number, number, number] = [0, 0, 0];
    let mode = { ...MODE.idle };
    const pointer = { x: -9999, y: -9999, active: false };

    const stateListener = (s: AuthFieldState) => {
      // eased toward on each frame below
    };
    listeners.add(stateListener);

    const syncColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim();
      const m = v.match(/(\d+\.?\d*)/g);
      if (m && m.length >= 3) rgb = [+m[0], +m[1], +m[2]];
    };
    syncColor();
    const themeObs = new MutationObserver(syncColor);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const build = () => {
      const count = Math.min(140, Math.round((w * h) / 9000));
      nodes = [];
      for (let i = 0; i < count; i++) {
        const layer: 0 | 1 = Math.random() < 0.55 ? 0 : 1;
        const bx = Math.random() * w;
        const by = Math.random() * h;
        nodes.push({
          bx,
          by,
          x: bx,
          y: by,
          vx: 0,
          vy: 0,
          layer,
          glyph: Math.random() < 0.12 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : null,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    const LINK_DIST = 120;
    const RADIUS = 140;

    const step = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      time += dt;

      const target = MODE[currentState] ?? MODE.idle;
      mode.drift += (target.drift - mode.drift) * Math.min(1, dt * 2);
      mode.alpha += (target.alpha - mode.alpha) * Math.min(1, dt * 2);
      mode.jitter += (target.jitter - mode.jitter) * Math.min(1, dt * 3);

      ctx.clearRect(0, 0, w, h);

      // organic drift — cheap flow field via layered sine, no RNG per frame
      for (const n of nodes) {
        const speed = n.layer === 0 ? 3.2 : 6.5;
        const driftX = Math.sin(time * 0.15 * mode.drift + n.phase) * speed * dt;
        const driftY = Math.cos(time * 0.12 * mode.drift + n.phase * 1.3) * speed * dt;
        n.bx += driftX;
        n.by += driftY;
        if (n.bx < -20) n.bx = w + 20;
        if (n.bx > w + 20) n.bx = -20;
        if (n.by < -20) n.by = h + 20;
        if (n.by > h + 20) n.by = -20;

        if (pointer.active && n.layer === 1) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < RADIUS * RADIUS && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / RADIUS) * 90;
            n.vx += (dx / d) * f * dt;
            n.vy += (dy / d) * f * dt;
          }
        }
        if (mode.jitter > 0.02) {
          n.vx += (Math.random() - 0.5) * mode.jitter * 40 * dt;
          n.vy += (Math.random() - 0.5) * mode.jitter * 40 * dt;
        }
        n.vx += (-38 * (n.x - n.bx) - 6 * n.vx) * dt;
        n.vy += (-38 * (n.y - n.by) - 6 * n.vy) * dt;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }

      // links — sparse mesh between nearby nodes, foreground layer only
      ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.05 * mode.alpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.layer !== 1) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (b.layer !== 1) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            ctx.globalAlpha = 1 - Math.sqrt(d2) / LINK_DIST;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // nodes — dots + sparse glyphs
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      for (const n of nodes) {
        const base = n.layer === 0 ? 0.045 : 0.09;
        const shimmer = 0.85 + 0.15 * Math.sin(time * 0.6 + n.phase);
        const a = base * mode.alpha * shimmer;
        ctx.globalAlpha = Math.min(0.4, a);
        if (n.glyph) {
          ctx.font = `${n.layer === 0 ? 10 : 13}px ui-monospace, monospace`;
          ctx.fillText(n.glyph, n.x, n.y);
        } else {
          const r = n.layer === 0 ? 1 : 1.6;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(step);
    };

    if (!reduced) {
      raf = requestAnimationFrame(step);
    } else {
      running = false;
      ctx.clearRect(0, 0, w, h);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      themeObs.disconnect();
      listeners.delete(stateListener);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
