import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { fragment } from '../codebase/testFixtures';
import { findMisplacedResponsibilities } from './misplacedResponsibilities';

describe('findMisplacedResponsibilities', () => {
  it('役割に含まれない処理をクラス単位でまとめて返す', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'a.cs', classes: [{
      id: 'tax', name: 'TaxCalculator', roleResponsibilities: ['tax'], methods: [
        { id: 'method', name: 'run', visibility: 'public', fragments: [
          { ...fragment('tax-fragment', 1, 'tax'), label: '税を計算する' },
          { ...fragment('save', 1, 'persistence'), label: '注文をDBに保存する' },
          { ...fragment('mail', 1, 'notification'), label: '確認メールを送る' },
        ] },
      ],
    }] }] };

    // Act
    const violations = findMisplacedResponsibilities(codebase);

    // Assert
    expect(violations).toEqual([{ classId: 'tax', fragments: [
      { id: 'save', label: '注文をDBに保存する' },
      { id: 'mail', label: '確認メールを送る' },
    ] }]);
  });

  it('役割の複数値、call、空クラス、タグなしクラスを正しく扱う', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'a.cs', classes: [
      { id: 'allowed', name: 'Allowed', roleResponsibilities: ['tax', 'persistence'], methods: [{ id: 'm1', name: 'run', visibility: 'public', fragments: [fragment('tax', 1, 'tax'), fragment('save', 1, 'persistence'), fragment('call', 1, 'call')] }] },
      { id: 'tax-only', name: 'TaxOnly', roleResponsibilities: ['tax'], methods: [{ id: 'm3', name: 'run', visibility: 'public', fragments: [fragment('only-tax', 1, 'tax')] }] },
      { id: 'calls-only', name: 'CallsOnly', roleResponsibilities: ['tax'], methods: [{ id: 'm4', name: 'run', visibility: 'public', fragments: [fragment('only-call', 1, 'call')] }] },
      { id: 'empty', name: 'Empty', roleResponsibilities: ['tax'], methods: [] },
      { id: 'untagged', name: 'Untagged', methods: [{ id: 'm2', name: 'run', visibility: 'public', fragments: [fragment('mail', 1, 'notification')] }] },
    ] }] };

    // Act
    const violations = findMisplacedResponsibilities(codebase);

    // Assert
    expect(violations).toEqual([]);
  });
});
