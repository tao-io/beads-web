import { describe, it, expect } from 'vitest';

import {
  formatBeadId,
  formatStatus,
  formatShortDate,
  formatWorktreePath,
  getStatusDotColor,
  truncate,
  isBlocked,
} from '@/lib/bead-utils';

describe('formatBeadId', () => {
  it('uppercases BD- prefix IDs', () => {
    expect(formatBeadId('bd-abc')).toBe('BD-ABC');
    expect(formatBeadId('BD-ABC')).toBe('BD-ABC');
  });

  it('truncates long BD- IDs to maxLen', () => {
    expect(formatBeadId('bd-abcdefghijklm', 6)).toBe('BD-hijklm');
  });

  it('extracts last segment for non-BD IDs', () => {
    expect(formatBeadId('beads-kanban-ui-abc123')).toBe('BD-abc123');
  });

  it('uses maxLen param for short ID', () => {
    expect(formatBeadId('project-abcdefgh', 8)).toBe('BD-abcdefgh');
    expect(formatBeadId('project-abcdefgh', 4)).toBe('BD-abcd');
  });
});

describe('formatStatus', () => {
  it('formats known statuses', () => {
    expect(formatStatus('open')).toBe('Open');
    expect(formatStatus('in_progress')).toBe('In Progress');
    expect(formatStatus('inreview')).toBe('In Review');
    expect(formatStatus('closed')).toBe('Closed');
  });

  it('returns unknown status as-is', () => {
    // @ts-expect-error testing unknown status
    expect(formatStatus('unknown')).toBe('unknown');
  });
});

describe('getStatusDotColor', () => {
  it('returns correct color classes', () => {
    expect(getStatusDotColor('open')).toContain('blue');
    expect(getStatusDotColor('in_progress')).toContain('amber');
    expect(getStatusDotColor('inreview')).toContain('purple');
    expect(getStatusDotColor('closed')).toContain('green');
  });
});

describe('formatShortDate', () => {
  it('formats valid dates', () => {
    const result = formatShortDate('2025-01-23T10:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('23');
    expect(result).toContain('2025');
  });

  it('returns original string for invalid dates', () => {
    expect(formatShortDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatWorktreePath', () => {
  it('extracts worktree folder name', () => {
    expect(formatWorktreePath('/repo/.worktrees/bd-abc123')).toBe('bd-abc123');
  });

  it('falls back to last path segment', () => {
    expect(formatWorktreePath('/some/path/folder')).toBe('folder');
  });

  it('returns original for simple paths', () => {
    expect(formatWorktreePath('simple')).toBe('simple');
  });
});

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    const result = truncate('hello world this is long', 10);
    expect(result.length).toBeLessThanOrEqual(14); // 10 + trim + ellipsis
    expect(result).toContain('\u2026');
  });
});

describe('isBlocked', () => {
  it('returns false for closed tasks', () => {
    expect(isBlocked({ status: 'closed', deps: ['dep1'] })).toBe(false);
  });

  it('returns true for open tasks with deps', () => {
    expect(isBlocked({ status: 'open', deps: ['dep1'] })).toBe(true);
  });

  it('returns false for tasks without deps', () => {
    expect(isBlocked({ status: 'open', deps: [] })).toBe(false);
    expect(isBlocked({ status: 'open' })).toBe(false);
  });
});
