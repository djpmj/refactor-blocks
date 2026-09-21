import { describe, expect, it } from 'vitest';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import type { ChangeRequest } from './ChangeRequest';
import { findChangeSites } from './findChangeSites';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };

describe('findChangeSites', () => {
  it('依頼の責務を持つ処理を含むメソッドのIDを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const sites = findChangeSites(codebase, taxRequest);

    // Assert
    expect(sites).toEqual(['method-place']);
  });

  it('責務が複数のメソッドに散らばっていれば、出現順にすべて返す', () => {
    // Arrange
    const base = sampleCodebase();
    const [orderFile, taxFile] = base.files;
    const codebase = {
      files: [
        orderFile,
        {
          ...taxFile,
          classes: [
            { id: 'class-tax', name: 'TaxCalculator', methods: [{ id: 'method-calc', name: 'calc', visibility: 'public' as const, fragments: [fragment('f-x', 5, 'tax')] }] },
          ],
        },
      ],
    };

    // Act
    const sites = findChangeSites(codebase, taxRequest);

    // Assert
    expect(sites).toEqual(['method-place', 'method-calc']);
  });

  it('責務を持つ処理がなければ空を返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const sites = findChangeSites(codebase, { ...taxRequest, responsibility: 'shipping' });

    // Assert
    expect(sites).toEqual([]);
  });
});
