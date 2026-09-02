"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IconPlus, IconFile, IconSpark, IconClose, IconCheck } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { ClassDetailView } from "./ClassDetailView";
import { listClasses, createClass, deleteClass, type ClassData } from "@/lib/api";

const EMOJI_OPTIONS = ["📚", "🧬", "⚗️", "🌍", "💻", "📐", "🎨", "🎵", "📊", "🏛️"];

function MasteryBar({ value }: { value: number }) {
  return (
    <div className="progress-track">
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
  );
}

export function ClassesView() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const [newDesc, setNewDesc] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await listClasses();
      setClasses(data);
    } catch {
      setClasses([
        {
          id: "demo-bio",
          name: "Biology 101",
          emoji: "🧬",
          sources: 12,
          progress: 68,
          description: "Cell biology, genetics, evolution, and ecology fundamentals.",
        },
        {
          id: "demo-chem",
          name: "Organic Chemistry",
          emoji: "⚗️",
          sources: 8,
          progress: 42,
          description: "Functional groups, reaction mechanisms, and spectroscopy.",
        },
        {
          id: "demo-hist",
          name: "World History",
          emoji: "🌍",
          sources: 5,
          progress: 85,
          description: "Major civilizations, revolutions, and modern geopolitics.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const newClass = await createClass({
        name: newName.trim(),
        emoji: newEmoji,
        description: newDesc.trim() || "New class",
      });
      setClasses((prev) => [newClass, ...prev]);
      resetForm();
    } catch {
      const fallback: ClassData = {
        id: `local-${Date.now()}`,
        name: newName.trim(),
        emoji: newEmoji,
        sources: 0,
        progress: 0,
        description: newDesc.trim() || "New class",
      };
      setClasses((prev) => [fallback, ...prev]);
      resetForm();
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewEmoji("📚");
    setNewDesc("");
    setShowCreate(false);
  };

  const handleDelete = async (classId: string) => {
    try {
      await deleteClass(classId);
    } finally {
      setClasses((prev) => prev.filter((c) => c.id !== classId));
    }
  };

  if (selectedClass) {
    return (
      <ClassDetailView
        classId={selectedClass.id}
        className={selectedClass.name}
        emoji={selectedClass.emoji}
        onBack={() => setSelectedClass(null)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div>
          <p className="label-caps mb-2">Classes</p>
          <h1 className="text-display-xl text-text-primary">Your study subjects</h1>
          <p className="text-[14px] text-text-secondary mt-1.5">
            Each class gets its own AI tutor, sources, and mastery tracking.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-accent control flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-full"
        >
          <IconPlus size={15} />
          New Class
        </button>
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="surface-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-text-primary">Create New Class</h3>
                <button onClick={resetForm} className="icon-button">
                  <IconClose size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label-caps mb-2 block">Icon</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-9 h-9 rounded-card grid place-items-center text-lg transition-all ${
                          newEmoji === emoji
                            ? "bg-accent-soft border border-accent shadow-rest scale-110"
                            : "bg-ink-soft border border-transparent hover:border-border"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label-caps mb-1.5 block">Class Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Biology 101"
                    className="w-full px-3 py-2.5 bg-ink-soft border border-border rounded-card text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label-caps mb-1.5 block">Description</label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="What is this class about?"
                    className="w-full px-3 py-2.5 bg-ink-soft border border-border rounded-card text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className="btn-accent control flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-card disabled:opacity-40"
                  >
                    {creating ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <IconCheck size={15} />
                    )}
                    {creating ? "Creating..." : "Create Class"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="control px-4 py-2.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-ink-soft rounded-card transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="grid place-items-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Class Grid */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, i) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              layout
              className="surface-panel p-5 group cursor-pointer hover:shadow-soft transition-all duration-200"
              onClick={() => setSelectedClass(cls)}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{cls.emoji}</span>
                <Badge
                  tone={cls.progress >= 70 ? "success" : cls.progress >= 40 ? "info" : "warning"}
                >
                  {cls.progress}%
                </Badge>
              </div>
              <h3 className="text-[14px] font-semibold text-text-primary mb-1">{cls.name}</h3>
              <p className="text-[12px] text-text-secondary mb-3 line-clamp-2">{cls.description}</p>
              <MasteryBar value={cls.progress / 100} />
              <div className="flex items-center gap-1.5 mt-3 text-[11px] text-text-secondary">
                <IconFile size={11} />
                <span>{cls.sources} sources</span>
                <span className="text-text-faint">·</span>
                <IconSpark size={11} className="text-text-faint" />
                <span>AI Tutor ready</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && classes.length === 0 && (
        <div className="grid place-items-center min-h-[40vh]">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-card bg-accent-soft grid place-items-center mx-auto mb-4">
              <IconPlus size={24} className="text-accent" />
            </div>
            <h3 className="text-display-sm text-text-primary mb-2">No classes yet</h3>
            <p className="text-[13px] text-text-secondary mb-4">
              Create your first class to start studying with an AI tutor that adapts to how you learn.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-accent control flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-full mx-auto"
            >
              <IconPlus size={15} />
              Create Class
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
