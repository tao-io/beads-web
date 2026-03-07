"use client";

import { useState, useCallback, useMemo } from "react";

import type { Bead } from "@/types";

export interface UseBeadDetailResult {
  /** The currently selected bead (resolved from allBeads) */
  detailBead: Bead | null;
  /** Whether the detail panel is open */
  isDetailOpen: boolean;
  /** Open detail for a bead */
  openBead: (bead: Bead) => void;
  /** Handle detail panel open/close */
  handleDetailOpenChange: (open: boolean) => void;
  /** Navigate to a bead by ID (for dependencies, memory panel, etc.) */
  navigateToBead: (beadId: string) => void;
}

/**
 * Manages bead detail panel state: which bead is selected, open/close logic.
 *
 * @param allBeads - All beads array (used to resolve bead by ID)
 */
export function useBeadDetail(allBeads: Bead[]): UseBeadDetailResult {
  const [detailBeadId, setDetailBeadId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const detailBead = useMemo(() => {
    if (!detailBeadId) return null;
    return allBeads.find((b) => b.id === detailBeadId) || null;
  }, [detailBeadId, allBeads]);

  const openBead = useCallback((bead: Bead) => {
    setDetailBeadId(bead.id);
    setIsDetailOpen(true);
  }, []);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setIsDetailOpen(open);
    if (!open) {
      setDetailBeadId(null);
    }
  }, []);

  const navigateToBead = useCallback((beadId: string) => {
    const found = allBeads.find((b) => b.id === beadId);
    if (found) {
      setDetailBeadId(found.id);
      setIsDetailOpen(true);
    }
  }, [allBeads]);

  return {
    detailBead,
    isDetailOpen,
    openBead,
    handleDetailOpenChange,
    navigateToBead,
  };
}
