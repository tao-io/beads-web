import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, resolving any conflicts.
 *
 * @param inputs - An array of class names to merge.
 * @returns A string of merged and optimized class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Check if a project path is a Dolt-only project (no filesystem).
 * Dolt-only projects use the `dolt://` prefix convention.
 */
export function isDoltProject(path: string | null | undefined): boolean {
  return !!path && path.startsWith("dolt://");
}
