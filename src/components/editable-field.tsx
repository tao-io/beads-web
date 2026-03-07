"use client";

import { useState, useRef, useEffect, useCallback } from "react";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface EditableFieldProps {
  /** Current value */
  value: string;
  /** Called with new value on save */
  onSave: (value: string) => Promise<void>;
  /** Whether editing is disabled (e.g., dolt:// projects) */
  disabled?: boolean;
  /** Use textarea instead of input */
  multiline?: boolean;
  /** CSS class for the display text */
  className?: string;
  /** Placeholder when empty */
  placeholder?: string;
}

/**
 * Click-to-edit field with auto-save on blur/Enter.
 * Shows a subtle spinner during save and reverts on error.
 */
export function EditableField({
  value,
  onSave,
  disabled,
  multiline,
  className,
  placeholder,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync edit value when value prop changes
  useEffect(() => {
    if (!isEditing) setEditValue(value);
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const save = useCallback(async () => {
    const trimmed = editValue.trim();
    if (trimmed === value.trim() || trimmed === "") {
      setEditValue(value);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      // Revert on error — toast is handled by caller
      setEditValue(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      save();
    }
    // Ctrl/Cmd+Enter for multiline
    if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  };

  if (disabled) {
    return (
      <span className={className}>
        {value || <span className="text-zinc-600 italic">{placeholder}</span>}
      </span>
    );
  }

  if (isSaving) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <Loader2 className="size-3 animate-spin text-zinc-500" />
        <span className="text-zinc-500">Saving…</span>
      </span>
    );
  }

  if (isEditing) {
    const sharedClasses = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:border-zinc-500";

    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          rows={Math.max(3, editValue.split("\n").length)}
          className={cn(sharedClasses, "resize-y text-sm", className)}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className={cn(sharedClasses, className)}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-text hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors",
        className
      )}
      title="Click to edit"
    >
      {value || <span className="text-zinc-600 italic">{placeholder}</span>}
    </span>
  );
}
