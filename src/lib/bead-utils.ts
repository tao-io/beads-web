/**
 * Shared utility functions for bead display formatting.
 *
 * These pure functions are used across bead-card, bead-detail, epic-card,
 * and subtask-list components.
 */

import type { BeadStatus } from "@/types";

/**
 * Format bead ID for display.
 * @param id - Raw bead ID (e.g., "beads-kanban-ui-jkk.1" or "BD-abc123")
 * @param maxLen - Max chars for the short ID portion (6 for cards, 8 for detail)
 */
export function formatBeadId(id: string, maxLen = 6): string {
  if (id.startsWith("BD-") || id.startsWith("bd-")) {
    return id.length > maxLen + 3 ? `BD-${id.slice(-maxLen)}` : id.toUpperCase();
  }
  const parts = id.split("-");
  const shortId = parts[parts.length - 1];
  return `BD-${shortId.slice(0, maxLen)}`;
}

/**
 * Format status for display (e.g., "in_progress" -> "In Progress")
 */
export function formatStatus(status: BeadStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "inreview":
      return "In Review";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

/**
 * Get Tailwind color class for status indicator dot
 */
export function getStatusDotColor(status: BeadStatus): string {
  switch (status) {
    case "open":
      return "text-blue-400";
    case "in_progress":
      return "text-amber-400";
    case "inreview":
      return "text-purple-400";
    case "closed":
      return "text-green-400";
    default:
      return "text-zinc-400";
  }
}

/**
 * Format date for short display (e.g., "Jan 23, 2025")
 */
export function formatShortDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Format worktree path for display.
 * Shows only the worktree folder name (e.g., "bd-beads-kanban-ui-0io")
 */
export function formatWorktreePath(path: string): string {
  const match = path.match(/\.worktrees\/(.+)$/);
  if (match) {
    return match[1];
  }
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "\u2026";
}

/**
 * Detect if bead is blocked by checking for unresolved dependencies.
 * Closed tasks are never blocked.
 */
export function isBlocked(bead: { status: string; deps?: string[] }): boolean {
  if (bead.status === "closed") return false;
  return (bead.deps ?? []).length > 0;
}
