"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LandingPage } from "@/components/landing/LandingPage";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ClassesView } from "@/components/classes/ClassesView";
import { SettingsView } from "@/components/settings/SettingsView";
import type { NavView } from "@/components/layout/Sidebar";

export default function HomePage() {
  const { user } = useAuth();
  const [view, setView] = useState<NavView>("home");

  if (!user) return <LandingPage />;

  return (
    <AppShell current={view} onNavigate={setView} rightRail={null}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          {view === "home" ? (
            <DashboardView onNavigate={setView} />
          ) : view === "classes" ? (
            <ClassesView />
          ) : view === "settings" ? (
            <SettingsView />
          ) : (
            <DashboardView onNavigate={setView} />
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
