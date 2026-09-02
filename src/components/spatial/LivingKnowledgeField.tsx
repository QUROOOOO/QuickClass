"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "motion/react";

interface ConceptNode {
  id: string;
  label: string;
  mastery: number; // 0-1: 0=weak, 0.5=learning, 1=mastered
  x: number;
  y: number;
  z: number;
  size: "sm" | "md" | "lg";
}

interface Connection {
  from: string;
  to: string;
}

interface LivingKnowledgeFieldProps {
  className?: string;
  sourceName?: string;
  concepts?: ConceptNode[];
  connections?: Connection[];
  mastery?: number;
  practiceScore?: { correct: number; total: number };
  interactive?: boolean;
  compact?: boolean;
}

const DEFAULT_CONCEPTS: ConceptNode[] = [
  { id: "glycolysis", label: "Glycolysis", mastery: 0.9, x: 0, y: -40, z: 20, size: "lg" },
  { id: "krebs", label: "Krebs Cycle", mastery: 0.45, x: -60, y: 30, z: 10, size: "md" },
  { id: "etc", label: "Electron Transport", mastery: 0.2, x: 60, y: 30, z: 0, size: "md" },
  { id: "atp", label: "ATP", mastery: 0.7, x: 0, y: 70, z: 15, size: "lg" },
  { id: "glucose", label: "Glucose", mastery: 0.85, x: -30, y: -10, z: 25, size: "sm" },
  { id: "pyruvate", label: "Pyruvate", mastery: 0.55, x: 30, y: -10, z: 5, size: "sm" },
];

const DEFAULT_CONNECTIONS: Connection[] = [
  { from: "glucose", to: "glycolysis" },
  { from: "glycolysis", to: "pyruvate" },
  { from: "pyruvate", to: "krebs" },
  { from: "krebs", to: "etc" },
  { from: "etc", to: "atp" },
  { from: "glycolysis", to: "atp" },
];

function getMasteryColor(mastery: number): string {
  if (mastery >= 0.7) return "var(--mastery-mastered)";
  if (mastery >= 0.4) return "var(--mastery-learning)";
  return "var(--mastery-attention)";
}

function getMasteryLabel(mastery: number): string {
  if (mastery >= 0.7) return "Mastered";
  if (mastery >= 0.4) return "Learning";
  return "Needs review";
}

function getNodeSize(size: "sm" | "md" | "lg"): number {
  return size === "lg" ? 36 : size === "md" ? 28 : 22;
}

export function LivingKnowledgeField({
  className = "",
  sourceName = "Cellular Respiration.pdf",
  concepts = DEFAULT_CONCEPTS,
  connections = DEFAULT_CONNECTIONS,
  mastery = 0.72,
  practiceScore = { correct: 7, total: 10 },
  interactive = true,
  compact = false,
}: LivingKnowledgeFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-200, 200], [3, -3]), {
    stiffness: 100,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-200, 200], [-3, 3]), {
    stiffness: 100,
    damping: 30,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left - rect.width / 2);
      mouseY.set(e.clientY - rect.top - rect.height / 2);
    },
    [interactive, mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    setHoveredNode(null);
  }, [mouseX, mouseY]);

  const hoveredConnections = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    return new Set(
      connections
        .filter((c) => c.from === hoveredNode || c.to === hoveredNode)
        .flatMap((c) => [c.from, c.to])
    );
  }, [hoveredNode, connections]);

  const fieldWidth = compact ? 280 : 360;
  const fieldHeight = compact ? 200 : 260;
  const centerX = fieldWidth / 2;
  const centerY = fieldHeight / 2 - 10;

  const circumference = 2 * Math.PI * 44;
  const masteryOffset = circumference - (mastery / 1) * circumference;

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: fieldWidth, height: fieldHeight }}
    >
      <motion.div
        className="w-full h-full field-depth"
        style={{
          rotateX: interactive ? rotateX : 0,
          rotateY: interactive ? rotateY : 0,
        }}
      >
        <svg
          width={fieldWidth}
          height={fieldHeight}
          viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
          className="absolute inset-0"
        >
          {/* Connection lines */}
          {connections.map((conn) => {
            const from = concepts.find((c) => c.id === conn.from);
            const to = concepts.find((c) => c.id === conn.to);
            if (!from || !to) return null;

            const isHighlighted =
              hoveredNode && hoveredConnections.has(conn.from) && hoveredConnections.has(conn.to);
            const isDimmed = hoveredNode && !isHighlighted;

            return (
              <motion.line
                key={`${conn.from}-${conn.to}`}
                x1={centerX + from.x}
                y1={centerY + from.y}
                x2={centerX + to.x}
                y2={centerY + to.y}
                className="field-connector"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: isDimmed ? 0.15 : isHighlighted ? 0.8 : 0.35,
                  stroke: isHighlighted ? "var(--text-secondary)" : "var(--border-strong)",
                }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              />
            );
          })}
        </svg>

        {/* Concept nodes */}
        {concepts.map((concept, i) => {
          const size = getNodeSize(concept.size);
          const isHovered = hoveredNode === concept.id;
          const isConnected = hoveredConnections.has(concept.id);
          const isDimmed = hoveredNode && !isHovered && !isConnected;

          return (
            <motion.div
              key={concept.id}
              className="absolute field-node"
              style={{
                left: centerX + concept.x - size / 2,
                top: centerY + concept.y - size / 2,
                width: size,
                height: size,
                transformStyle: "preserve-3d",
              }}
              initial={{ opacity: 0, scale: 0, z: concept.z }}
              animate={{
                opacity: isDimmed ? 0.3 : 1,
                scale: isHovered ? 1.25 : 1,
                z: isHovered ? concept.z + 20 : concept.z,
              }}
              transition={{
                duration: 0.4,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              onMouseEnter={() => interactive && setHoveredNode(concept.id)}
              onMouseLeave={() => interactive && setHoveredNode(null)}
            >
              <div
                className="w-full h-full rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: getMasteryColor(concept.mastery),
                  backgroundColor: `color-mix(in srgb, ${getMasteryColor(concept.mastery)} 12%, transparent)`,
                  boxShadow: isHovered
                    ? `0 0 0 4px color-mix(in srgb, ${getMasteryColor(concept.mastery)} 15%, transparent)`
                    : "none",
                }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: size * 0.35,
                    height: size * 0.35,
                    backgroundColor: getMasteryColor(concept.mastery),
                  }}
                />
              </div>

              {/* Tooltip */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-1/2 -translate-x-1/2 popover-glass rounded-lg px-2.5 py-1.5 z-50 whitespace-nowrap"
                    style={{ top: size + 8 }}
                  >
                    <p className="text-[11px] font-medium text-text-primary">{concept.label}</p>
                    <p className="text-[10px] text-text-secondary">
                      {Math.round(concept.mastery * 100)}% · {getMasteryLabel(concept.mastery)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Source label */}
      <motion.div
        className="absolute top-3 left-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="label-micro">SOURCE</p>
        <p className="text-[11px] font-medium text-text-primary mt-0.5">{sourceName}</p>
      </motion.div>

      {/* Mastery ring — bottom right */}
      <motion.div
        className="absolute bottom-3 right-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <svg width="56" height="56" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--ink-soft)" strokeWidth="4" />
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            className="mastery-ring"
            stroke={getMasteryColor(mastery)}
            strokeWidth="4"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: masteryOffset }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            transform="rotate(-90 50 50)"
          />
          <text
            x="50"
            y="46"
            textAnchor="middle"
            className="fill-text-primary"
            fontSize="18"
            fontWeight="600"
            fontFamily="var(--font-geist)"
          >
            {Math.round(mastery * 100)}
          </text>
          <text
            x="50"
            y="62"
            textAnchor="middle"
            className="fill-text-secondary"
            fontSize="9"
            fontFamily="var(--font-geist)"
            letterSpacing="0.08em"
          >
            MASTERY
          </text>
        </svg>
      </motion.div>

      {/* Practice score — bottom left */}
      {!compact && (
        <motion.div
          className="absolute bottom-3 left-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <p className="label-micro">PRACTICE</p>
          <p className="text-[13px] font-semibold text-text-primary mt-0.5 font-mono">
            {practiceScore.correct}<span className="text-text-faint"> / </span>{practiceScore.total}
          </p>
        </motion.div>
      )}
    </div>
  );
}
