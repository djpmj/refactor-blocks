import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { fragmentCode } from './fragmentCode';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';

function codebaseWithParseHooks(): Codebase {
  return {
    files: [{
      id: 'f',
      path: 'x',
      classes: [
        { id: 'csv', name: 'Csv', methods: [{ id: 'csv-parse', name: 'parse', visibility: 'protected', fragments: [] }] },
        { id: 'json', name: 'Json', methods: [{ id: 'json-parse', name: 'parse', visibility: 'protected', fragments: [] }] },
      ],
    }],
  };
}

describe('fragmentCode', () => {
  it('同じ名前のメソッドを複数 uses に持つ呼び出し処理は、最初の1回だけ引数つきで呼ぶ', () => {
    // Arrange
    const fragment = { id: 'call', label: 'parse', lines: 1, responsibility: CALL_RESPONSIBILITY, uses: ['csv-parse', 'json-parse'], callArguments: ['lines'] };

    // Act
    const code = fragmentCode(codebaseWithParseHooks(), fragment, 'csharp');

    // Assert
    expect(code).toBe('parse(lines);');
  });
});
