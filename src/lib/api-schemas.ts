/**
 * Zod schemas for validating critical API responses.
 * Only covers endpoints where malformed data causes silent runtime errors.
 */

import { z } from "zod/v4";

export const CommentSchema = z.object({
  id: z.number(),
  issue_id: z.string(),
  author: z.string(),
  text: z.string(),
  created_at: z.string(),
});

export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.optional(z.string()),
  status: z.string(),
  priority: z.number(),
  issue_type: z.string(),
  owner: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  comments: z.array(CommentSchema),
  parent_id: z.optional(z.string()),
  children: z.optional(z.array(z.string())),
  design_doc: z.optional(z.string()),
  deps: z.optional(z.array(z.string())),
  blockers: z.optional(z.array(z.string())),
  relates_to: z.optional(z.array(z.string())),
  _originalStatus: z.optional(z.string()),
});

export const BeadsResponseSchema = z.object({
  beads: z.array(BeadSchema),
});

export const PRChecksSchema = z.object({
  total: z.number(),
  passed: z.number(),
  failed: z.number(),
  pending: z.number(),
  status: z.enum(["success", "failure", "pending"]),
});

export const PRInfoSchema = z.object({
  number: z.number(),
  url: z.string(),
  state: z.enum(["open", "merged", "closed"]),
  checks: PRChecksSchema,
  mergeable: z.boolean(),
});

export const PRStatusSchema = z.object({
  has_remote: z.boolean(),
  branch_pushed: z.boolean(),
  pr: z.nullable(PRInfoSchema),
  rate_limit: z.object({
    remaining: z.number(),
    limit: z.number(),
    reset_at: z.string(),
  }),
});

export const WorktreeStatusSchema = z.object({
  exists: z.boolean(),
  worktree_path: z.nullable(z.string()),
  branch: z.nullable(z.string()),
  ahead: z.number(),
  behind: z.number(),
  dirty: z.boolean(),
  last_modified: z.nullable(z.string()),
});
