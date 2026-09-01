"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  IconPlus,
  IconSpark,
  IconProjects,
  IconClock,
  IconFile,
  IconArrow,
} from "@/components/ui/Icon";
import type { NavView } from "@/components/layout/Sidebar";

interface DashboardViewProps {
  onNavigate: (view: NavView) => void;
}

const DEMO_CLASSES = [
  {
    id: "bio-101",
    name: "Biology 101",
    sources: 12,
    lastStudied: "2 hours ago",
    progress: 68,
    emoji: "🧬",
  },
  {
    id: "chem-201",
    name: "Organic Chemistry",
    sources: 8,
    lastStudied: "Yesterday",
    progress: 42,
    emoji: "⚗️",
  },
  {
    id: "hist-301",
    name: "World History",
    sources: 15,
    lastStudied: "3 days ago",
    progress: 85,
    emoji: "🌍",
  },
];

const QUICK_ACTIONS = [
  {
    id: "create",
    label: "Create Class",
    description: "Start a new subject",
    icon: IconPlus,
    accent: false,
  },
  {
    id: "upload",
    label: "Upload Notes",
    description: "Add study materials",
    icon: IconFile,
    accent: false,
  },
  {
    id: "quiz",
    label: "Quick Quiz",
    description: "Test your knowledge",
    icon: IconSpark,
    accent: true,
  },
];

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="display text-display-lg text-text-primary">
          Welcome back
        </h1>
        <p className="text-[15px] text-text-secondary mt-1">
          Pick up where you left off, or start something new.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => {
                if (action.id === "create" || action.id === "upload") {
                  onNavigate("classes");
                }
              }}
              className="control group surface-panel rounded-panel p-4 text-left
                hover:shadow-lifted transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-9 h-9 rounded-card grid place-items-center ${
                    action.accent
                      ? "bg-[#ED6A2F]/10 text-[#ED6A2F]"
                      : "bg-ink-soft text-text-secondary"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <IconArrow
                  size={14}
                  className="text-text-faint opacity-0 group-hover:opacity-100
                    transition-opacity duration-200 mt-1"
                />
              </div>
              <p className="text-[13px] font-medium text-text-primary mt-3">
                {action.label}
              </p>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {action.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Recent Classes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-text-primary label-caps">
            Recent Classes
          </h2>
          <button
            onClick={() => onNavigate("classes")}
            className="control text-[12px] text-text-secondary hover:text-text-primary
              transition-colors flex items-center gap-1"
          >
            View all
            <IconArrow size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DEMO_CLASSES.map((cls) => (
            <motion.button
              key={cls.id}
              onHoverStart={() => setHoveredClass(cls.id)}
              onHoverEnd={() => setHoveredClass(null)}
              onClick={() => onNavigate("classes")}
              className="control surface-panel rounded-panel p-4 text-left
                hover:shadow-lifted transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cls.emoji}</span>
                  <div>
                    <p className="text-[13px] font-medium text-text-primary">
                      {cls.name}
                    </p>
                    <p className="text-[11px] text-text-secondary flex items-center gap-1.5 mt-0.5">
                      <IconFile size={10} />
                      {cls.sources} sources
                      <span className="text-text-faint">·</span>
                      <IconClock size={10} />
                      {cls.lastStudied}
                    </p>
                  </div>
                </div>
                <IconArrow
                  size={14}
                  className="text-text-faint opacity-0 group-hover:opacity-100
                    transition-opacity duration-200 shrink-0 mt-0.5"
                />
              </div>

              {/* Progress bar */}
              <div className="mt-3 progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${cls.progress}%` }}
                />
              </div>
              <p className="text-[10px] text-text-faint mt-1.5 label-micro">
                {cls.progress}% mastered
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Study Streak */}
      <div className="surface-panel rounded-panel p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-card bg-ink-soft grid place-items-center">
            <IconProjects size={20} className="text-text-secondary" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-text-primary">
              Study Streak
            </p>
            <p className="text-[12px] text-text-secondary">
              You&apos;ve studied 5 days in a row. Keep it up!
            </p>
          </div>
          <div className="text-right">
            <p className="display text-display-md text-text-primary">5</p>
            <p className="text-[10px] text-text-faint label-micro">days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
