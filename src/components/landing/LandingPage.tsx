"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BrandMark } from "@/components/brand/BrandMark";
import { LivingKnowledgeField } from "@/components/spatial/LivingKnowledgeField";
import { IconArrow, IconFile, IconSpark, IconCheck, IconRefresh } from "@/components/ui/Icon";

function NavItem({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors duration-200"
    >
      {children}
    </button>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="surface-panel p-5 group"
    >
      <div className="w-9 h-9 rounded-card bg-accent-soft flex items-center justify-center mb-3 group-hover:bg-accent/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-display-sm text-text-primary mb-1.5">{title}</h3>
      <p className="text-[13.5px] leading-relaxed text-text-secondary">{description}</p>
    </motion.div>
  );
}

function HowItWorksStep({
  number,
  title,
  description,
  index,
}: {
  number: string;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-5"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center">
        <span className="text-[13px] font-semibold text-accent">{number}</span>
      </div>
      <div>
        <h3 className="text-display-sm text-text-primary mb-1">{title}</h3>
        <p className="text-[13.5px] leading-relaxed text-text-secondary">{description}</p>
      </div>
    </motion.div>
  );
}

export function LandingPage() {
  const { user, adapter } = useAuth();
  const signOut = () => adapter.signOut();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-dvh overflow-y-auto bg-page">
      {/* Fixed nav */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-[15px] font-semibold text-text-primary tracking-tight">QuickClass</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <NavItem>Features</NavItem>
            <NavItem>How it works</NavItem>
            {user ? (
              <button onClick={signOut} className="control px-4 py-1.5 text-[12.5px] font-medium text-text-secondary hover:text-text-primary border border-border rounded-full hover:border-border-strong transition-all">
                Sign out
              </button>
            ) : (
              <a href="/login" className="control px-4 py-1.5 text-[12.5px] font-medium text-text-secondary hover:text-text-primary border border-border rounded-full hover:border-border-strong transition-all">
                Sign in
              </a>
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {mobileMenuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="4" y1="16" x2="20" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="md:hidden border-t border-border bg-surface-primary px-6 py-4 flex flex-col gap-3"
          >
            <NavItem>Features</NavItem>
            <NavItem>How it works</NavItem>
            {user ? (
              <button onClick={signOut} className="text-left text-[13px] font-medium text-text-secondary">Sign out</button>
            ) : (
              <a href="/login" className="text-[13px] font-medium text-text-secondary">Sign in</a>
            )}
          </motion.div>
        )}
      </motion.nav>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 grain grain-hero" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
                <span className="text-[11px] font-medium text-accent">Built for students, by students</span>
              </div>

              <h1 className="text-display-2xl text-text-primary mb-5">
                Study smarter.
                <br />
                <span className="text-text-secondary">Not harder.</span>
              </h1>

              <p className="text-[15px] leading-relaxed text-text-secondary max-w-md mb-8">
                Upload your lecture notes, textbooks, and slides. QuickClass builds a living knowledge map, then tutors you through it and adapts to your gaps.
              </p>

              <div className="flex flex-wrap gap-3">
                {user ? (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.dispatchEvent(new CustomEvent("navigate", { detail: "home" }));
                    }}
                    className="control btn-accent inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium"
                  >
                    Go to Dashboard
                    <IconArrow size={14} />
                  </a>
                ) : (
                  <a
                    href="/signup"
                    className="control btn-accent inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium"
                  >
                    Start for free
                    <IconArrow size={14} />
                  </a>
                )}
                {!user && (
                  <a
                    href="/login"
                    className="control inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-full text-[13px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-all"
                  >
                    Sign in
                  </a>
                )}
              </div>
            </motion.div>

            {/* Right */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center"
            >
              <div className="surface-panel p-6 relative grain grain-card">
                <LivingKnowledgeField
                  sourceName="Cellular Respiration.pdf"
                  mastery={0.72}
                  practiceScore={{ correct: 7, total: 10 }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t-editorial">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <p className="label-caps mb-3">What QuickClass does</p>
            <h2 className="text-display-lg text-text-primary">
              The core loop:
              <br />
              <span className="text-text-secondary">Upload, Diagnose, Teach, Practice, Measure, Adapt, Master</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            <FeatureCard
              icon={<IconFile size={16} className="text-accent" />}
              title="Upload Anything"
              description="PDFs, slides, notes, textbooks. QuickClass extracts, chunks, and indexes your materials into a searchable knowledge base."
              index={0}
            />
            <FeatureCard
              icon={<IconSpark size={16} className="text-accent" />}
              title="AI Tutor"
              description="Ask questions grounded in YOUR sources. Every answer cites where it came from, so you can verify and go deeper."
              index={1}
            />
            <FeatureCard
              icon={<IconCheck size={16} className="text-accent" />}
              title="Practice & Quiz"
              description="Adaptive quizzes that detect misconceptions and target your weak areas. One question at a time, with full explanations."
              index={2}
            />
            <FeatureCard
              icon={<IconRefresh size={16} className="text-accent" />}
              title="Adapts to You"
              description="A learner model tracks your mastery per concept. The more you study, the smarter QuickClass gets about what you need next."
              index={3}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t-editorial">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <p className="label-caps mb-3">How it works</p>
            <h2 className="text-display-lg text-text-primary">
              From upload to mastery
              <br />
              <span className="text-text-secondary">in three steps</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <HowItWorksStep
              number="1"
              title="Upload your materials"
              description="Drop in your lecture PDFs, textbook chapters, or slide decks. QuickClass extracts and indexes everything automatically."
              index={0}
            />
            <HowItWorksStep
              number="2"
              title="Meet your AI tutor"
              description="Ask questions, get explanations, and work through problems, all grounded in the sources you uploaded. No hallucinations."
              index={1}
            />
            <HowItWorksStep
              number="3"
              title="Study & master"
              description="Take adaptive quizzes, review flashcards, and watch your mastery grow. QuickClass learns what you know and what you still need."
              index={2}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-6 border-t-editorial overflow-hidden">
        <div className="absolute inset-0 grain grain-hero" />
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-display-xl text-text-primary mb-4">
              Ready to study differently?
            </h2>
            <p className="text-[15px] text-text-secondary mb-8 max-w-md mx-auto">
              Join students who are already learning smarter. Free to start, no credit card required.
            </p>
            {!user && (
              <a
                href="/signup"
                className="control btn-accent inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-medium"
              >
                Get started
                <IconArrow size={15} />
              </a>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t-editorial">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[13px] font-medium text-text-primary">QuickClass</span>
          </div>
          <p className="text-[11px] text-text-faint">
            Study smarter. Not harder.
          </p>
        </div>
      </footer>
    </div>
  );
}
