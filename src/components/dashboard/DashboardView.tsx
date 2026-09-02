"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LivingKnowledgeField } from "@/components/spatial/LivingKnowledgeField";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconSpark, IconCheck, IconChevronRight } from "@/components/ui/Icon";
import type { NavView } from "@/components/layout/Sidebar";

interface DashboardViewProps {
  onNavigate: (view: NavView) => void;
}

const DEMO_CLASSES = [
  {
    id: "1",
    name: "Cellular Respiration",
    emoji: "🧬",
    sources: 4,
    mastery: 0.72,
    lastStudied: "2 hours ago",
    weakAreas: ["Krebs Cycle", "Electron Transport Chain"],
  },
  {
    id: "2",
    name: "Organic Chemistry",
    emoji: "⚗️",
    sources: 6,
    mastery: 0.45,
    lastStudied: "Yesterday",
    weakAreas: ["Stereochemistry", "Reaction Mechanisms"],
  },
  {
    id: "3",
    name: "World History",
    emoji: "🌍",
    sources: 3,
    mastery: 0.85,
    lastStudied: "3 days ago",
    weakAreas: [],
  },
];

function MasteryBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-text-secondary w-24 truncate">{label}</span>
      <div className="flex-1 progress-track">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor:
              value >= 0.7
                ? "var(--mastery-mastered)"
                : value >= 0.4
                  ? "var(--mastery-learning)"
                  : "var(--mastery-attention)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="text-[11px] font-mono text-text-secondary w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-panel p-4 text-left group hover:shadow-soft transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-card bg-accent-soft flex items-center justify-center group-hover:bg-accent transition-colors group-hover:text-white">
          {icon}
        </div>
        <IconChevronRight size={14} className="text-text-faint group-hover:text-text-secondary transition-colors" />
      </div>
      <h3 className="text-[13px] font-semibold text-text-primary mb-0.5">{title}</h3>
      <p className="text-[12px] text-text-secondary leading-relaxed">{description}</p>
    </button>
  );
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <p className="label-caps mb-2">Dashboard</p>
        <h1 className="text-display-xl text-text-primary">
          Your learning cockpit
        </h1>
        <p className="text-[14px] text-text-secondary mt-2">
          Track progress across all your subjects. Pick up where you left off.
        </p>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10"
      >
        <QuickAction
          icon={<IconPlus size={14} className="text-accent" />}
          title="New Class"
          description="Start a new subject"
          onClick={() => onNavigate("classes")}
        />
        <QuickAction
          icon={<IconSpark size={14} className="text-accent" />}
          title="Quick Quiz"
          description="Test your knowledge"
          onClick={() => {}}
        />
        <QuickAction
          icon={<IconCheck size={14} className="text-accent" />}
          title="Review Due"
          description="3 flashcards due"
          onClick={() => {}}
        />
      </motion.div>

      {/* Main grid: classes + weak areas */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent classes — left 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="label-caps">Recent Classes</p>
            <button
              onClick={() => onNavigate("classes")}
              className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              View all
            </button>
          </div>

          {DEMO_CLASSES.map((cls, i) => (
            <motion.button
              key={cls.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              onClick={() => onNavigate("classes")}
              className={`w-full surface-panel p-4 text-left group hover:shadow-soft transition-all duration-200 ${
                selectedClass === cls.id ? "ring-1 ring-[var(--border-strong)]" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0 mt-0.5">{cls.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold text-text-primary truncate">{cls.name}</h3>
                    <Badge
                      tone={cls.mastery >= 0.7 ? "success" : cls.mastery >= 0.4 ? "info" : "warning"}
                    >
                      {Math.round(cls.mastery * 100)}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-text-secondary mb-2.5">
                    {cls.sources} sources, last studied {cls.lastStudied}
                  </p>
                  <div className="progress-track">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor:
                          cls.mastery >= 0.7
                            ? "var(--mastery-mastered)"
                            : cls.mastery >= 0.4
                              ? "var(--mastery-learning)"
                              : "var(--mastery-attention)",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${cls.mastery * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
                <IconChevronRight size={14} className="text-text-faint group-hover:text-text-secondary transition-colors mt-1 flex-shrink-0" />
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Right column — weak areas + streak */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-4"
        >
          {/* Weak areas */}
          <div className="surface-panel p-4">
            <p className="label-caps mb-3">Needs Attention</p>
            <div className="space-y-2.5">
              {DEMO_CLASSES.flatMap((cls) =>
                cls.weakAreas.map((area) => ({ area, cls: cls.name, emoji: cls.emoji }))
              ).map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--mastery-attention)] flex-shrink-0" />
                  <span className="text-[12px] text-text-primary flex-1 truncate">{item.area}</span>
                  <span className="text-[10px] text-text-faint">{item.emoji}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Study streak */}
          <div className="surface-panel p-4">
            <p className="label-caps mb-3">Study Streak</p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-display-xl text-text-primary">7</span>
              <span className="text-[12px] text-text-secondary">days</span>
            </div>
            <div className="flex gap-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <div
                  key={i}
                  className={`flex-1 h-6 rounded-sm flex items-center justify-center text-[9px] font-medium ${
                    i < 6
                      ? "bg-accent text-white"
                      : "bg-ink-soft text-text-faint"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Mastery overview — mini LivingKnowledgeField */}
          <div className="surface-panel p-4">
            <p className="label-caps mb-3">Mastery Overview</p>
            <LivingKnowledgeField
              compact
              sourceName="All classes"
              mastery={0.67}
              practiceScore={{ correct: 23, total: 35 }}
              interactive={false}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
