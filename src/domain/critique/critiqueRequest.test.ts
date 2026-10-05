import { describe, expect, it } from 'vitest';
import { sampleCodebase } from '../codebase/testFixtures';
import { scoreCodebase } from '../scoring/score';
import { buildCritiqueRequest } from './critiqueRequest';

const LOOSE_STAGE = {
  goal: 'メソッドの責務を分ける',
  limits: { method: 100, class: 100, file: 100 },
  responsibilityLimit: 100,
  dependencyLimit: 100,
};

describe('buildCritiqueRequest', () => {
  it('目標文と、ファイルごとの構成(クラス名・メソッド名・行数)をまとめる', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    expect(request.goal).toBe(LOOSE_STAGE.goal);
    expect(request.score).toBe(score);
    const orderFile = request.files[0];
    expect(orderFile).toEqual({
      lines: 30,
      deductionPoints: 0,
      classes: [
        {
          name: 'OrderService',
          lines: 30,
          methods: [{ name: 'placeOrder', visibility: 'public', lines: 27 }],
        },
      ],
    });
    expect(orderFile).not.toHaveProperty('path');
  });

  it.each(['fragments', 'stub', 'enviedClassName'] as const)('通常のメソッドには%sキーを含めない', (key) => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const method = request.files[0]?.classes[0]?.methods[0];
    expect(method).not.toHaveProperty(key);
  });

  it('行数の違反があるファイルには、その減点がdeductionPointsに入る', () => {
    // Arrange
    const codebase = sampleCodebase();
    const stage = { ...LOOSE_STAGE, limits: { method: 20, class: 100, file: 100 } };
    const score = scoreCodebase(codebase, stage);

    // Act
    const request = buildCritiqueRequest(codebase, stage, score);

    // Assert
    const orderFile = request.files[0];
    const taxFile = request.files[1];
    expect(orderFile.deductionPoints).toBe(10);
    // TaxCalculator には行数の減点は入らず、空のクラスの10点だけが入る
    expect(taxFile.deductionPoints).toBe(10);
  });

  it('継承元(extends)のクラス名を含める', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase = {
      files: base.files.map((file, index) =>
        index === 0 ? { ...file, classes: [{ ...file.classes[0], superclassId: 'class-tax' }] } : file,
      ),
    };
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const orderClass = request.files[0].classes[0];
    expect(orderClass.superclassName).toBe('TaxCalculator');
    expect(orderClass.interfaceNames).toBeUndefined();
  });

  it('実装先(implements)のクラス名を含める', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase = {
      files: base.files.map((file, index) =>
        index === 0 ? { ...file, classes: [{ ...file.classes[0], interfaceIds: ['class-tax'] }] } : file,
      ),
    };
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const orderClass = request.files[0].classes[0];
    expect(orderClass.interfaceNames).toEqual(['TaxCalculator']);
  });

  it('空実装のメソッドにはstub: trueを含める', () => {
    // Arrange
    const codebase = {
      files: [
        {
          id: 'file-stub',
          path: 'src/Stub.ts',
          classes: [
            {
              id: 'class-stub',
              name: 'Stub',
              methods: [{ id: 'method-stub', name: 'run', visibility: 'public' as const, fragments: [{ id: 'f1', label: '未対応', lines: 2, responsibility: 'x', stub: true }] }],
            },
          ],
        },
      ],
    };
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const method = request.files[0]?.classes[0]?.methods[0];
    expect(method).toMatchObject({ stub: true });
  });

  it('フィールドを持つクラスには、名前と可視性を宣言順で含める', () => {
    // Arrange
    const base = sampleCodebase();
    const codebase = {
      files: base.files.map((file, index) =>
        index === 0
          ? {
              ...file,
              classes: [
                {
                  ...file.classes[0],
                  fields: [
                    { id: 'field-status', name: 'status', visibility: 'public' as const },
                    { id: 'field-total', name: 'total', visibility: 'private' as const },
                  ],
                },
              ],
            }
          : file,
      ),
    };
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const orderClass = request.files[0].classes[0];
    expect(orderClass.fields).toEqual([
      { name: 'status', visibility: 'public' },
      { name: 'total', visibility: 'private' },
    ]);
  });

  it('フィールドのないクラスにはfieldsキーを含めない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const orderClass = request.files[0].classes[0];
    expect(orderClass).not.toHaveProperty('fields');
  });

  it('Feature EnvyのメソッドだけenviedClassNameを含める', () => {
    // Arrange
    const codebase = {
      files: [
        {
          id: 'file-a',
          path: 'src/A.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              methods: [
                {
                  id: 'method-envy',
                  name: 'run',
                  visibility: 'public' as const,
                  fragments: [{ id: 'f1', label: 'do', lines: 1, responsibility: 'x', reads: ['field-b1', 'field-b2'] }],
                },
              ],
            },
          ],
        },
        {
          id: 'file-b',
          path: 'src/B.ts',
          classes: [
            {
              id: 'class-b',
              name: 'B',
              methods: [],
              fields: [
                { id: 'field-b1', name: 'b1', visibility: 'public' as const },
                { id: 'field-b2', name: 'b2', visibility: 'public' as const },
              ],
            },
          ],
        },
      ],
    };
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const method = request.files[0]?.classes[0]?.methods[0];
    expect(method).toMatchObject({ enviedClassName: 'B' });
  });

  it('継承元・実装先がなければ何も含めない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const orderClass = request.files[0].classes[0];
    expect(orderClass.superclassName).toBeUndefined();
    expect(orderClass.interfaceNames).toBeUndefined();
  });
});
