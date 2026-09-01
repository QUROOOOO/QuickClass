"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { IconFile, IconSpark, IconCheck, IconRefresh } from "@/components/ui/Icon";

const features = [
  {
    icon: IconFile,
    title: "Upload Anything",
    desc: "PDFs, notes, slides, textbooks. QuickClass reads and understands your course materials instantly.",
  },
  {
    icon: IconSpark,
    title: "AI Tutor",
    desc: "Ask questions, get answers grounded in YOUR sources. Every response cites where it came from.",
  },
  {
    icon: IconCheck,
    title: "Practice & Quiz",
    desc: "Adaptive quizzes that target your weak spots. Flashcards that use spaced repetition.",
  },
  {
    icon: IconRefresh,
    title: "Adapts to You",
    desc: "Tracks what you know and what you don't. Adjusts difficulty and focus as you improve.",
  },
];

const steps = [
  { num: "1", title: "Upload your materials", desc: "Drop in your PDFs, lecture notes, or textbooks." },
  { num: "2", title: "Get your AI tutor", desc: "QuickClass builds a tutor grounded in your sources." },
  { num: "3", title: "Study & master", desc: "Chat, quiz, take notes. Watch your mastery grow." },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--page)] overflow-y-auto" style={{ height: "100dvh" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--glass-border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="w-7 h-7 text-[var(--ink)]" />
            <span className="display text-[15px]">QuickClass</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--ink-soft)] text-[var(--text-secondary)] text-[11.5px] font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            Built for students, by students
          </div>
          <h1 className="display text-[clamp(2.5rem,6vw,4rem)] leading-[1.05] tracking-[-0.03em] mb-5">
            Study smarter.<br />Not harder.
          </h1>
          <p className="text-[var(--text-secondary)] text-[17px] leading-relaxed max-w-xl mx-auto mb-8">
            Upload your course materials. QuickClass transforms them into an AI tutor that teaches, quizzes, and adapts to how you learn.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Start for free</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">Sign in</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="label-caps text-[var(--text-faint)] mb-3">Features</p>
            <h2 className="display text-[clamp(1.5rem,3vw,2.2rem)] tracking-[-0.02em]">
              Everything you need to ace your exams
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="surface-panel p-6 flex gap-4">
                <div className="w-10 h-10 rounded-[var(--radius-control)] bg-[var(--ink-soft)] flex items-center justify-center shrink-0">
                  <f.icon size={20} className="text-[var(--ink)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[14px] mb-1">{f.title}</h3>
                  <p className="text-[var(--text-secondary)] text-[13px] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-[var(--surface-tint)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="label-caps text-[var(--text-faint)] mb-3">How it works</p>
            <h2 className="display text-[clamp(1.5rem,3vw,2.2rem)] tracking-[-0.02em]">
              Three steps to mastery
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-[var(--page)] display text-[15px] flex items-center justify-center mx-auto mb-4">
                  {s.num}
                </div>
                <h3 className="font-semibold text-[14px] mb-1.5">{s.title}</h3>
                <p className="text-[var(--text-secondary)] text-[13px] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="display text-[clamp(1.5rem,3vw,2.2rem)] tracking-[-0.02em] mb-4">
            Ready to transform how you study?
          </h2>
          <p className="text-[var(--text-secondary)] text-[15px] mb-8">
            Join students who are already studying smarter with QuickClass.
          </p>
          <Link href="/signup">
            <Button size="lg">Get started — it&apos;s free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark className="w-5 h-5 text-[var(--text-faint)]" />
            <span className="text-[var(--text-faint)] text-[12px]">QuickClass</span>
          </div>
          <p className="text-[var(--text-faint)] text-[11px]">
            &copy; {new Date().getFullYear()} QuickClass. Study smarter.
          </p>
        </div>
      </footer>
    </div>
  );
}
