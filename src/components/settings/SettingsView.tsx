"use client";

import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Section } from "../ui/Section";
import { IconUser, IconSettings } from "../ui/Icon";

type SettingsTab = "profile" | "providers";

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your account and preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-surface-secondary rounded-lg w-fit">
        <TabButton
          active={activeTab === "profile"}
          onClick={() => setActiveTab("profile")}
          icon={<IconUser size={16} />}
          label="Profile"
        />
        <TabButton
          active={activeTab === "providers"}
          onClick={() => setActiveTab("providers")}
          icon={<IconSettings size={16} />}
          label="Providers"
        />
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileSection />}
      {activeTab === "providers" && <ProvidersSection />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-surface-primary text-text-primary shadow-sm"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProfileSection() {
  return (
    <Section className="p-6">
      <h2 className="text-lg font-medium text-text-primary mb-4">Profile</h2>
      <p className="text-sm text-text-secondary">
        Your profile information is managed through your authentication provider.
      </p>
    </Section>
  );
}

function ProvidersSection() {
  return (
    <Section className="p-6">
      <h2 className="text-lg font-medium text-text-primary mb-4">AI Providers</h2>
      <p className="text-sm text-text-secondary mb-4">
        Configure your AI model providers for enhanced features.
      </p>
      <div className="space-y-3">
        <ProviderCard name="OpenAI" status="available" />
        <ProviderCard name="Anthropic" status="available" />
        <ProviderCard name="Google" status="available" />
      </div>
    </Section>
  );
}

function ProviderCard({
  name,
  status,
}: {
  name: string;
  status: "active" | "available" | "unavailable";
}) {
  const statusColors = {
    active: "bg-green-500",
    available: "bg-text-secondary",
    unavailable: "bg-red-500",
  };

  return (
    <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-sm font-medium text-text-primary">{name}</span>
      </div>
      <Button variant="secondary" size="sm">
        Configure
      </Button>
    </div>
  );
}
