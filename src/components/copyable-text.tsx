"use client";

import { useState, useCallback } from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface CopyableTextProps {
  /** Text to display */
  children: React.ReactNode;
  /** Text to copy to clipboard (defaults to children text content) */
  copyText: string;
  className?: string;
}

/**
 * Inline text that copies to clipboard on click.
 * Shows a checkmark + "Copied" for 2 seconds after copying.
 */
export function CopyableText({ children, copyText, className }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
    }
  }, [copyText]);

  if (copied) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-green-400", className)}>
        <Check className="size-3" aria-hidden="true" />
        Copied
      </span>
    );
  }

  return (
    <span
      onClick={handleCopy}
      className={cn("cursor-copy hover:text-zinc-200 transition-colors", className)}
      title={`Click to copy: ${copyText}`}
    >
      {children}
    </span>
  );
}
