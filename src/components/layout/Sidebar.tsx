"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BrandMark } from "@/components/brand/BrandMark";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  IconHome,
  IconProjects,
  IconChevronLeft,
  IconUser,
  IconSettings,
  IconMonitor,
  IconLogout,
} from "@/components/ui/Icon";

export type NavView = "home" | "classes" | "settings";

interface SidebarProps {
  current: NavView;
  onNavigate: (view: NavView) => void;
  collapsed: boolean;
  onToggle: () => void;
}

/** Theme — exact order and labels. Selection via surface/border/weight only. */
function ThemeControl({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const options: { id: "system" | "light" | "dark"; label: string }[] = [
    { id: "system", label: "SYSTEM" },
    { id: "light", label: "BRIGHT" },
    { id: "dark", label: "DARK" },
  ];
  return (
    <div className={compact ? "py-1" : "px-1 py-1"}>
      <div
        className="grid grid-cols-3 gap-0.5 p-0.5 rounded-full border border-border"
        style={{ background: "var(--ink-soft)" }}
        role="radiogroup"
        aria-label="Theme"
      >
        {options.map((o) => {
          const active = theme === o.id;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.id)}
              title={o.label}
              className={`control flex items-center justify-center gap-1 h-7 rounded-full text-[10px] font-medium whitespace-nowrap px-1 ${
                active
                  ? "bg-surface-primary dark:bg-white/12 text-text-primary font-semibold border border-border-strong shadow-rest"
                  : "text-text-secondary border border-transparent hover:text-text-primary"
              }`}
            >
              {o.id === "system" && <IconMonitor size={11} />}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Sidebar — stable application chrome.
 *
 * Header is a strict column: the brand owns its row, the collapse
 * control owns the row beneath it. They can never overlap — there
 * is no absolute positioning involved. Only the sidebar width
 * animates (~240ms ease-out); the control never translates.
 * ⌘/Ctrl + B toggles. The account area opens a contextual popover.
 */
export function Sidebar({ current, onNavigate, collapsed, onToggle }: SidebarProps) {
  const { user, adapter } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const goHome = useCallback(() => onNavigate("home"), [onNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggle();
      }
      if (e.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const initials = user ? user.name.slice(0, 2).toUpperCase() : null;

  return (
    <nav
      aria-label="Primary"
      onClick={collapsed ? onToggle : undefined}
      className="hidden sm:flex flex-col shrink-0 rounded-[18px] overflow-hidden
        sidebar-glass select-none cursor-default"
      style={{
        width: collapsed ? 76 : 236,
        transition: "width 240ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        margin: "10px 0 10px 10px",
      }}
    >
      {/* Header — brand + collapse chevron share one row; only width ever animates. */}
      <div className="shrink-0 px-2.5 pt-2.5 pb-1">
        <div className="h-10 flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (collapsed) onToggle();
              else goHome();
            }}
            aria-label={collapsed ? "QuickClass — expand and go home" : "QuickClass — home"}
            aria-current={current === "home" ? "page" : undefined}
            className={`control flex items-center gap-2.5 h-10 min-w-0 ${collapsed ? "mx-auto px-1" : "px-1.5"}`}
          >
            <BrandMark className="w-[22px] h-[22px] shrink-0 text-text-primary" />
            {!collapsed && (
              <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap text-text-primary">
                QuickClass
              </span>
            )}
          </button>

          {/* Bare chevron — no button chrome. Same row as the brand, never
              moves vertically. Fully absent (not just hidden) when collapsed;
              the sidebar re-expands via the brand mark instead. */}
          {!collapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label="Collapse sidebar"
              aria-keyshortcuts="Control+B"
              className="ml-auto shrink-0 p-1 text-text-faint hover:text-text-primary transition-colors"
            >
              <IconChevronLeft size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation — Dashboard, Classes */}
      <div className="flex-1 overflow-hidden px-2.5 py-1 space-y-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (collapsed) {
              onToggle();
              return;
            }
            onNavigate("home");
          }}
          aria-current={current === "home" ? "page" : undefined}
          title={collapsed ? "Dashboard" : undefined}
          className={`control w-full flex items-center gap-3 px-2.5 py-2 text-[13px]
            ${collapsed ? "justify-center px-0" : ""}
            ${
              current === "home"
                ? "bg-ink-soft-strong text-text-primary font-medium"
                : "text-text-secondary hover:text-text-primary hover:bg-ink-soft"
            }`}
        >
          <IconHome size={17} />
          {!collapsed && <span className="truncate flex-1 text-left">Dashboard</span>}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (collapsed) {
              onToggle();
              return;
            }
            onNavigate("classes");
          }}
          aria-current={current === "classes" ? "page" : undefined}
          title={collapsed ? "Classes" : undefined}
          className={`control w-full flex items-center gap-3 px-2.5 py-2 text-[13px]
            ${collapsed ? "justify-center px-0" : ""}
            ${
              current === "classes"
                ? "bg-ink-soft-strong text-text-primary font-medium"
                : "text-text-secondary hover:text-text-primary hover:bg-ink-soft"
            }`}
        >
          <IconProjects size={17} />
          {!collapsed && <span className="truncate flex-1 text-left">Classes</span>}
        </button>
      </div>

      {/* Account — contextual popover */}
      <div ref={accountRef} className="relative shrink-0 px-2.5 pb-2.5 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (collapsed) {
              onToggle();
              return;
            }
            setAccountOpen((v) => !v);
          }}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          className={`control w-full flex items-center gap-2.5 py-2 text-left hover:bg-ink-soft rounded-control ${
            collapsed ? "justify-center px-0" : "px-1.5"
          }`}
          title={collapsed ? (user ? user.name : "Sign in") : undefined}
        >
          {user ? (
            <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full bg-ink-soft-strong text-[10.5px] font-semibold text-text-primary">
              {initials}
            </span>
          ) : (
            <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full bg-ink-soft">
              <IconUser size={14} className="text-text-secondary" />
            </span>
          )}
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium truncate text-text-primary">
                {user ? user.name : "Sign in"}
              </span>
              <span className="block text-[11px] text-text-faint truncate">
                {user ? user.email : "Guest"}
              </span>
            </span>
          )}
        </button>

        <AnimatePresence>
          {accountOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              role="menu"
              className="popover-glass absolute bottom-full mb-2 left-0 right-0 z-30 rounded-[14px] p-1.5"
            >
              {user && (
                <div className="flex items-center gap-2.5 px-2 py-2 mb-1 border-b border-border">
                  <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full bg-ink-soft-strong text-[10.5px] font-semibold text-text-primary">
                    {initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium text-text-primary truncate">
                      {user.name}
                    </span>
                    <span className="block text-[11px] text-text-faint truncate">{user.email}</span>
                  </span>
                </div>
              )}

              <div className="py-1 border-b border-border">
                <ThemeControl />
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setAccountOpen(false);
                  onNavigate("settings");
                }}
                className="control w-full flex items-center gap-2.5 px-2 py-2 mt-1 text-[12.5px]
                  text-text-secondary hover:text-text-primary hover:bg-ink-soft rounded-[8px]"
              >
                <IconSettings size={14} /> Settings
              </button>

              <div className="pt-1">
                {user ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await adapter.signOut();
                      setAccountOpen(false);
                    }}
                    className="control w-full flex items-center gap-2.5 px-2 py-2 text-[12.5px]
                      text-text-secondary hover:text-text-primary hover:bg-ink-soft rounded-[8px]"
                  >
                    <IconLogout size={14} /> Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountOpen(false);
                      window.location.href = "/login";
                    }}
                    className="control w-full flex items-center gap-2.5 px-2 py-2 text-[12.5px]
                      text-text-primary hover:bg-ink-soft rounded-[8px]"
                  >
                    <IconUser size={14} /> Sign in
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
