"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconPlus,
  IconFile,
  IconClock,
  IconSpark,
  IconClose,
  IconCheck,
} from "@/components/ui/Icon";
import { ClassDetailView } from "./ClassDetailView";
import { listClasses, createClass, deleteClass, type ClassData } from "@/lib/api";

const EMOJI_OPTIONS = ["📚", "🧬", "⚗️", "🌍", "💻", "📐", "🎨", "🎵", "📊", "🏛️"];

export function ClassesView() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const [newDesc, setNewDesc] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch classes on mount
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await listClasses();
      setClasses(data);
    } catch (err) {
      console.error("Failed to fetch classes:", err);
      // Fall back to demo data if backend is not running
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
      setNewName("");
      setNewEmoji("📚");
      setNewDesc("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create class:", err);
      // Fallback: create locally
      const fallbackClass: ClassData = {
        id: `local-${Date.now()}`,
        name: newName.trim(),
        emoji: newEmoji,
        sources: 0,
        progress: 0,
        description: newDesc.trim() || "New class",
      };
      setClasses((prev) => [fallbackClass, ...prev]);
      setNewName("");
      setNewEmoji("📚");
      setNewDesc("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (classId: string) => {
    try {
      await deleteClass(classId);
      setClasses((prev) => prev.filter((c) => c.id !== classId));
    } catch (err) {
      console.error("Failed to delete class:", err);
      // Fallback: remove locally
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
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="display text-display-lg text-text-primary">Classes</h1>
          <p className="text-[15px] text-text-secondary mt-1">
            Your study subjects. Each class gets its own AI tutor.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="control flex items-center gap-2 px-4 py-2.5 bg-text-primary text-page
            text-[13px] font-medium rounded-card hover:shadow-lifted transition-all"
        >
          <IconPlus size={15} />
          New Class
        </button>
      </div>

      {/* Create Class Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="surface-elevated rounded-panel p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-text-primary">
                  Create New Class
                </h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="icon-button p-1.5 text-text-secondary hover:text-text-primary"
                >
                  <IconClose size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Emoji picker */}
                <div>
                  <label className="label-caps text-text-secondary mb-2 block">
                    Icon
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-9 h-9 rounded-card grid place-items-center text-lg
                          transition-all ${
                            newEmoji === emoji
                              ? "bg-ink-soft-strong border border-border-strong shadow-rest scale-110"
                              : "bg-ink-soft border border-transparent hover:border-border"
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="label-caps text-text-secondary mb-1.5 block">
                    Class Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Biology 101"
                    className="w-full px-3 py-2.5 bg-ink-soft border border-border rounded-card
                      text-[13px] text-text-primary placeholder:text-text-faint
                      focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="label-caps text-text-secondary mb-1.5 block">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="What is this class about?"
                    className="w-full px-3 py-2.5 bg-ink-soft border border-border rounded-card
                      text-[13px] text-text-primary placeholder:text-text-faint
                      focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className="control flex items-center gap-2 px-4 py-2.5 bg-text-primary text-page
                      text-[13px] font-medium rounded-card hover:shadow-lifted transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <IconCheck size={15} />
                    )}
                    {creating ? "Creating..." : "Create Class"}
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="control px-4 py-2.5 text-[13px] text-text-secondary
                      hover:text-text-primary hover:bg-ink-soft rounded-card transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <div className="grid place-items-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Class Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {classes.map((cls) => (
            <motion.div
              key={cls.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="surface-panel rounded-panel p-5 group cursor-pointer
                hover:shadow-lifted transition-all duration-200"
              onClick={() => setSelectedClass(cls)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{cls.emoji}</span>
                  <div>
                    <h3 className="text-[14px] font-medium text-text-primary">
                      {cls.name}
                    </h3>
                    <p className="text-[12px] text-text-secondary mt-0.5 line-clamp-2">
                      {cls.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-[11px] text-text-secondary">
                <span className="flex items-center gap-1">
                  <IconFile size={11} />
                  {cls.sources} sources
                </span>
                <span className="flex items-center gap-1 ml-auto">
                  <IconSpark size={11} className="text-[#ED6A2F]" />
                  {cls.progress}% mastered
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${cls.progress}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && classes.length === 0 && (
        <div className="grid place-items-center min-h-[40vh]">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-card bg-ink-soft grid place-items-center mx-auto mb-4">
              <IconPlus size={24} className="text-text-faint" />
            </div>
            <p className="display text-display-sm text-text-primary mb-2">
              No classes yet
            </p>
            <p className="text-[13px] text-text-secondary mb-4">
              Create your first class to start studying with an AI tutor that
              adapts to how you learn.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="control flex items-center gap-2 px-4 py-2.5 bg-text-primary text-page
                text-[13px] font-medium rounded-card mx-auto"
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
