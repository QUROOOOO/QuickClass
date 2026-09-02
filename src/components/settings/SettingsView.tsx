"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import { IconUser, IconSettings } from "@/components/ui/Icon";

type SettingsTab = "profile" | "providers";

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <p className="label-caps mb-2">Settings</p>
        <h1 className="text-display-xl text-text-primary">Settings</h1>
        <p className="text-[14px] text-text-secondary mt-1.5">
          Manage your account and AI provider configuration.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="segmented mb-8">
        <button
          onClick={() => setActiveTab("profile")}
          data-active={activeTab === "profile"}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab("providers")}
          data-active={activeTab === "providers"}
        >
          Providers
        </button>
      </div>

      {activeTab === "profile" && <ProfileSection />}
      {activeTab === "providers" && <ProvidersSection />}
    </div>
  );
}

function ProfileSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-panel p-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center">
          <IconUser size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">Profile</h2>
          <p className="text-[12px] text-text-secondary">Your account information</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label-caps mb-1.5 block">Name</label>
          <div className="px-3 py-2.5 bg-ink-soft border border-border rounded-card text-[13px] text-text-primary">
            Demo Student
          </div>
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Email</label>
          <div className="px-3 py-2.5 bg-ink-soft border border-border rounded-card text-[13px] text-text-primary">
            student@example.com
          </div>
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Member since</label>
          <div className="px-3 py-2.5 bg-ink-soft border border-border rounded-card text-[13px] text-text-primary">
            January 2026
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProvidersSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="surface-panel p-6">
        <h2 className="text-[15px] font-semibold text-text-primary mb-1">AI Providers</h2>
        <p className="text-[12px] text-text-secondary mb-5">
          Configure which AI model powers your tutor. QuickClass works out of the box with demo mode, connect a provider for richer responses.
        </p>
        <div className="space-y-3">
          <ProviderCard
            name="Demo Mode"
            description="Built-in responses, no API key needed"
            status="active"
          />
          <ProviderCard
            name="OpenAI"
            description="GPT-4o, GPT-4o-mini"
            status="available"
          />
          <ProviderCard
            name="Anthropic"
            description="Claude 3.5 Sonnet, Claude 3 Haiku"
            status="available"
          />
          <ProviderCard
            name="Google"
            description="Gemini 1.5 Pro, Gemini 1.5 Flash"
            status="available"
          />
        </div>
      </div>
    </motion.div>
  );
}

function ProviderCard({
  name,
  description,
  status,
}: {
  name: string;
  description: string;
  status: "active" | "available" | "unavailable";
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-ink-soft rounded-card">
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full ${
            status === "active"
              ? "bg-[var(--success)]"
              : status === "available"
                ? "bg-text-faint"
                : "bg-[var(--error)]"
          }`}
        />
        <div>
          <span className="text-[13px] font-medium text-text-primary">{name}</span>
          <p className="text-[11px] text-text-secondary">{description}</p>
        </div>
      </div>
      <Badge tone={status === "active" ? "success" : status === "available" ? "neutral" : "error"}>
        {status}
      </Badge>
    </div>
  );
}
