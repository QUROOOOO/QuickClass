"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh grid place-items-center px-4 py-10 bg-outer overflow-y-auto">
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" aria-label="QuickClass — home" className="grid place-items-center w-11 h-11 rounded-[14px] bg-ink-soft-strong mb-4">
            <BrandMark className="w-6 h-6 text-text-primary" />
          </Link>
          <h1 className="display text-[22px] tracking-tight text-center">{title}</h1>
          <p className="mt-1.5 text-[13px] text-text-secondary text-center max-w-[280px]">{subtitle}</p>
        </div>

        <div className="surface-primary p-6 sm:p-7 shadow-soft">{children}</div>

        <div className="mt-5 text-center text-[13px] text-text-secondary">{footer}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="label-micro block mb-1.5 text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "control w-full px-3.5 py-2.5 text-[14px] bg-surface-secondary/50 border border-border rounded-control " +
  "text-text-primary placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent-soft";
