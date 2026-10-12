import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from './ChangeRequest';
import { rumoredRequests } from './rumors';

const request = (id: string, kind?: ChangeRequest['kind']): ChangeRequest => ({ id, title: id, description: '', responsibility: id, linesPerSite: 1, ...(kind === undefined ? {} : { kind }) });

describe('rumoredRequests', () => {
  it('excludes the first modify request and retains later requests in order', () => {
    const result = rumoredRequests({ changeRequests: [request('m1'), request('e1', 'extend'), request('m2'), request('e2', 'extend')] });
    expect(result.map(({ id }) => id)).toEqual(['m2', 'e2']);
  });

  it('returns no requests when only the first modify and extend are present', () => {
    expect(rumoredRequests({ changeRequests: [request('m'), request('e', 'extend')] })).toEqual([]);
  });

  it('returns no requests for an empty stage', () => {
    expect(rumoredRequests({ changeRequests: [] })).toEqual([]);
  });
});
