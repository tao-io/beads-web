import { describe, it, expect } from 'vitest';

import { isDoltProject } from '@/lib/utils';

describe('isDoltProject', () => {
  it('returns true for dolt:// paths', () => {
    expect(isDoltProject('dolt://beads_my-project')).toBe(true);
    expect(isDoltProject('dolt://anything')).toBe(true);
  });

  it('returns false for regular paths', () => {
    expect(isDoltProject('/home/user/project')).toBe(false);
    expect(isDoltProject('C:\\Users\\project')).toBe(false);
  });

  it('returns false for null/undefined/empty', () => {
    expect(isDoltProject(null)).toBe(false);
    expect(isDoltProject(undefined)).toBe(false);
    expect(isDoltProject('')).toBe(false);
  });
});
