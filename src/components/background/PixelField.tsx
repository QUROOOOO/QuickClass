"use client";

import { useEffect, useRef } from "react";

/**
 * PIXEL FIELD — a hidden surface of small blocks revealed by touch.
 *
 * Idle: the grid is mathematically present but visually silent —
 * the page reads as one flat color. When the cursor moves across
 * the background, blocks near the pointer are physically displaced;
 * their movement opens the gaps between neighbours and briefly
 * reveals that the whole surface is made of pixels. Away from the
 * pointer they settle back and vanish again.
 *
 * Rendering: single canvas, requestAnimationFrame, no React state
 * per frame. Blocks outside the active radius cost one distance
 * check and are not drawn below a visibility threshold.
 * prefers-reduced-motion disables the system entirely.
 */

const SPACING = 19; // px between block centers (desktop baseline) — tight, blocks nearly touch
const BLOCK = 15; // px block edge — ~4x larger, reads as a real block field on reveal
const RADIUS = 135; // interaction radius around the pointer
const STRENGTH = 900; // push force (accel px/s^2) — snappy reaction to the pointer
const SPRING = 95; // return stiffness — fast settle
const DAMPING = 20; // near-critical damping — fast without bounce/jitter
const MAX_REVEAL = 12; // displacement (px) that reads as fully revealed

interface Block {
  bx: number;
  by: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number; // current opacity 0..1
  idle: number; // whisper-faint resting opacity
}

export function PixelField() {
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
    let cols = 0;
    let rows = 0;
    let spacing = SPACING;
    let blocks: Block[] = [];
    let raf = 0;
    let last = performance.now();
    let running = true;
    let calm = 1; // reduced intensity over UI surfaces (composer)
    let calmTarget = 1;
    let rgb: [number, number, number] = [0, 0, 0];

    const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, speed: 0, active: false };

    const syncColor = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--text-primary")
        .trim();
      // rgba(0,0,0,0.92) / rgba(240,240,240,0.92)
      const m = v.match(/(\d+\.?\d*)/g);
      if (m && m.length >= 3) rgb = [+m[0], +m[1], +m[2]];
    };
    syncColor();
    const themeObs = new MutationObserver(syncColor);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const build = () => {
      spacing = window.innerWidth < 720 ? SPACING + 5 : SPACING;
      cols = Math.ceil(w / spacing) + 1;
      rows = Math.ceil(h / spacing) + 1;
      const n = cols * rows;
      blocks = new Array(n);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const bx = c * spacing + spacing / 2;
          const by = r * spacing + spacing / 2;
          const idle = 0.018 + (((i * 2654435761) >>> 0) % 100) / 100 * 0.02; // 0.018–0.038
          blocks[i] = { bx, by, x: bx, y: by, vx: 0, vy: 0, a: idle, idle };
        }
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
      // Convert viewport coordinates into canvas-local space via the
      // canvas's own bounding rect — correct even when an animated
      // ancestor (e.g. a Framer Motion transform) changes the
      // containing block for this `position: fixed` canvas.
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      calmTarget = el?.closest("[data-pixel-calm]") ? 0.35 : 1;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
      calmTarget = 1;
    };

    // Typing: an extremely subtle local stir near the focused control.
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const el = document.activeElement as HTMLElement | null;
      if (!el?.closest("[data-pixel-calm]")) return;
      const canvasRect = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cx = Math.min(Math.max(r.left - canvasRect.left + 40, 0), w);
      const cy = Math.min(Math.max(r.bottom - canvasRect.top - 10, 0), h);
      const c0 = Math.max(0, Math.floor((cx - RADIUS / 3) / spacing));
      const c1 = Math.min(cols - 1, Math.floor((cx + RADIUS / 3) / spacing));
      const r0 = Math.max(0, Math.floor((cy - RADIUS / 3) / spacing));
      const r1 = Math.min(rows - 1, Math.floor((cy + RADIUS / 3) / spacing));
      for (let rr = r0; rr <= r1; rr++) {
        for (let cc = c0; cc <= c1; cc++) {
          const b = blocks[rr * cols + cc];
          if (!b) continue;
          b.vx += (Math.random() - 0.5) * 6;
          b.vy += (Math.random() - 0.5) * 6;
        }
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKey);

    const step = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      // pointer speed → gentle strength modulation (clamped)
      const pdx = pointer.x - pointer.px;
      const pdy = pointer.y - pointer.py;
      const inst = Math.hypot(pdx, pdy) / Math.max(dt, 1 / 240);
      pointer.speed += (Math.min(inst, 2200) - pointer.speed) * Math.min(1, dt * 14);
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      calm += (calmTarget - calm) * Math.min(1, dt * 10);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

      const R2 = RADIUS * RADIUS;
      const forceScale = STRENGTH * calm * (0.75 + 0.45 * (pointer.speed / 2200));
      const cx = Math.max(0, Math.floor((pointer.x - RADIUS) / spacing));
      const c1 = Math.min(cols - 1, Math.floor((pointer.x + RADIUS) / spacing));
      const r0 = Math.max(0, Math.floor((pointer.y - RADIUS) / spacing));
      const r1 = Math.min(rows - 1, Math.floor((pointer.y + RADIUS) / spacing));

      // apply forces only within the active window
      if (pointer.active && pointer.x > -RADIUS && pointer.x < w + RADIUS && pointer.y > -RADIUS && pointer.y < h + RADIUS) {
        for (let r = r0; r <= r1; r++) {
          for (let c = cx; c <= c1; c++) {
            const b = blocks[r * cols + c];
            if (!b) continue;
            const dx = b.x - pointer.x;
            const dy = b.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= R2 || d2 < 0.01) continue;
            const d = Math.sqrt(d2);
            const fall = 1 - d / RADIUS;
            const f = fall * fall * forceScale * dt;
            b.vx += (dx / d) * f;
            // slight upward bias — the surface "lifts"
            b.vy += ((dy / d) * f) - f * 0.35;
          }
        }
      }

      let visible = 0;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        // spring back toward base
        b.vx += (-SPRING * (b.x - b.bx) - DAMPING * b.vx) * dt;
        b.vy += (-SPRING * (b.y - b.by) - DAMPING * b.vy) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        const dist = Math.hypot(b.x - b.bx, b.y - b.by);
        const reveal = dist > 0.15 ? Math.min(1, dist / MAX_REVEAL) : 0;
        const target = Math.max(b.idle, reveal * 0.55);
        b.a += (target - b.a) * Math.min(1, dt * 10);

        if (b.a > b.idle + 0.004) {
          visible++;
          ctx.globalAlpha = Math.min(0.5, b.a);
          const s = BLOCK * (1 + Math.max(0, b.a - b.idle) * 0.25);
          ctx.fillRect(b.x - s / 2, b.y - s / 2, s, s);
        }
      }

      // debug/verification hook
      const dbg = window as unknown as Record<string, unknown>;
      dbg.__pfVisible = visible;
      dbg.__pfBlocks = blocks.length;
      dbg.__pfCalm = +calm.toFixed(2);

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
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
      themeObs.disconnect();
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
