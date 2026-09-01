"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { IconArrow, IconPaperclip, IconFolder, IconChevron } from "@/components/ui/Icon";
import { useCurrent } from "@/components/current/CodeCurrentContext";
import { PixelField } from "@/components/background/PixelField";

interface HomeViewProps {
  onBegin: (goal: string, context?: string) => void;
  isLoading: boolean;
  hasProject: boolean;
  onOpenProject: () => void;
}

/**
 * Home — the composer.
 *
 * One job: capture what the user wants to build. The composer is the
 * page — no hero copy, no decoration. Context unfolds in place: a thin
 * strip that grows into a working area only as it is needed.
 */
export function HomeView({ onBegin, isLoading, hasProject, onOpenProject }: HomeViewProps) {
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [ctxOpen, setCtxOpen] = useState(false);
  const ctxRef = useRef<HTMLTextAreaElement>(null);
  const { setState: setCurrent } = useCurrent();

  const submit = useCallback(() => {
    if (!goal.trim() || isLoading) return;
    onBegin(goal, context);
  }, [goal, context, isLoading, onBegin]);

  const closeContext = useCallback(() => {
    if (!context.trim()) setCtxOpen(false);
  }, [context]);

  // auto-grow the context field as the user writes
  useEffect(() => {
    const el = ctxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [context, ctxOpen]);

  return (
    <div className="relative min-h-full grid place-items-center">
      <PixelField />
      <div className="relative z-10 w-full max-w-2xl px-5 sm:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="writing-surface p-6 sm:p-9" data-pixel-calm>
            <label htmlFor="home-goal" className="label-caps block mb-3 text-text-secondary">
              Your idea
            </label>
            <textarea
              id="home-goal"
              rows={6}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setCurrent(e.target.value.trim() ? "typing" : "idle");
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              placeholder="Describe the thing you want to build…"
              className="w-full resize-none bg-transparent text-[18px] leading-[1.6] text-text-primary
                placeholder:text-text-faint focus:outline-none"
            />

            {/* Context — a thin strip that unfolds in place */}
            <div className="mt-5 pt-5 border-t border-border">
              <button
                onClick={() => {
                  setCtxOpen((v) => !v);
                  if (!ctxOpen && !context) requestAnimationFrame(() => ctxRef.current?.focus());
                }}
                aria-expanded={ctxOpen}
                className="control w-full flex items-center gap-2.5 text-left group"
              >
                <IconChevron
                  size={13}
                  className={`text-text-faint transition-transform duration-200 ${ctxOpen ? "rotate-90" : ""}`}
                />
                <span className="label-caps text-text-secondary">Context</span>
                <span className="text-[12.5px] text-text-faint truncate">
                  {ctxOpen || context ? "" : "Links, constraints, preferences…"}
                </span>
                {context && !ctxOpen && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-ink-soft text-text-primary text-[10.5px] font-medium">
                    Added
                  </span>
                )}
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]
                  ${ctxOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden min-h-0">
                  <textarea
                    ref={ctxRef}
                    id="home-context"
                    rows={2}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    onBlur={closeContext}
                    placeholder="Links, constraints, preferences…"
                    className="mt-3 w-full resize-none bg-transparent text-[13.5px] leading-[1.55] text-text-secondary
                      placeholder:text-text-faint focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <button className="control inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] text-text-secondary border border-border rounded-control hover:text-text-primary hover:bg-surface-secondary">
                <IconPaperclip size={13} /> Attach files
              </button>
              <button className="control inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] text-text-secondary border border-border rounded-control hover:text-text-primary hover:bg-surface-secondary">
                <IconFolder size={13} /> Preferences
              </button>

              <div className="ml-auto">
                <Button
                  size="lg"
                  onClick={submit}
                  disabled={!goal.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Planning…
                    </>
                  ) : (
                    <>
                      Let&apos;s build <IconArrow size={14} />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Real projects only */}
        {hasProject && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8"
          >
            <h2 className="label-caps text-text-secondary mb-3">Recent project</h2>
            <button
              onClick={onOpenProject}
              className="surface-primary w-full flex items-center gap-4 p-4 text-left hover:shadow-soft transition-shadow"
            >
              <div className="w-10 h-10 rounded-control bg-ink-soft grid place-items-center shrink-0">
                <IconFolder size={16} className="text-text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary truncate">Current build</p>
                <p className="text-[12.5px] text-text-secondary truncate">Open the workspace</p>
              </div>
              <IconArrow size={15} className="ml-auto text-text-faint" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}