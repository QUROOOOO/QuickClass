"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar, type NavView } from "./Sidebar";
import { BrandMark } from "@/components/brand/BrandMark";
import { IconProjects, IconSettings } from "@/components/ui/Icon";

interface AppShellProps {
  current: NavView;
  onNavigate: (view: NavView) => void;
  rightRail?: ReactNode;
  children: ReactNode;
}

/**
 * App shell.
 *
 * Structure:
 *   outer environment (bg-outer, 8px breathing room)
 *   └─ application shell (shell-surface, 100dvh, overflow hidden)
 *      ├─ fixed sidebar (dark capsule, never scrolls)
 *      ├─ main workspace (the ONLY scroll region)
 *      └─ mobile bottom navigation (<sm)
 */
export function AppShell({ current, onNavigate, rightRail, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Tablet: sidebar auto-reduces to icons below lg.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) setCollapsed(true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="app-shell bg-outer p-0 sm:p-2">
      {/* Mobile top bar — brand returns home */}
      <div className="sm:hidden flex items-center gap-2 px-4 h-12 bg-outer shrink-0">
        <button onClick={() => onNavigate("home")} aria-label="Code Butler — home" className="control flex items-center gap-2">
          <BrandMark className="w-5 h-5 text-text-primary" />
          <span className="text-[13px] font-semibold tracking-tight text-text-primary">Code Butler</span>
        </button>
      </div>

      {/* Application shell */}
      <div className="shell-surface h-full overflow-hidden flex flex-col sm:flex-row">
        <Sidebar
          current={current}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />

        {/* Main workspace — the ONLY scroll region */}
        <div className="main-workspace flex-1 min-w-0">{children}</div>

        {/* Mobile bottom navigation */}
        <BottomNav current={current} onNavigate={onNavigate} />

        {/* Contextual glass inspector (xl) */}
        <AnimatePresence>
          {rightRail && (
            <motion.aside
              key="right-rail"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden xl:flex w-[320px] shrink-0 p-3"
            >
              <div className="glass w-full overflow-hidden">{rightRail}</div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BottomNav({
  current,
  onNavigate,
}: {
  current: NavView;
  onNavigate: (v: NavView) => void;
}) {
  const items: { id: NavView; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
    { id: "projects", label: "Projects", icon: IconProjects },
    { id: "settings", label: "Settings", icon: IconSettings },
  ];
  return (
    <nav
      aria-label="Mobile"
      className="sm:hidden shrink-0 flex items-stretch border-t border-border bg-shell px-2 pb-[env(safe-area-inset-bottom)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-medium rounded-control transition-colors
              ${active ? "text-text-primary bg-ink-soft" : "text-text-secondary"}`}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}