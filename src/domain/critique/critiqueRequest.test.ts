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
  it('目標文と、ファイルごとの構成(パス・クラス名・メソッド名・行数)をまとめる', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    expect(request.goal).toBe(LOOSE_STAGE.goal);
    expect(request.score).toBe(score);
    const orderFile = request.files.find((file) => file.path === 'src/OrderService.ts');
    expect(orderFile).toEqual({
      path: 'src/OrderService.ts',
      lines: 28,
      deductionPoints: 0,
      classes: [
        {
          name: 'OrderService',
          lines: 28,
          methods: [{ name: 'placeOrder', visibility: 'public', lines: 26 }],
        },
      ],
    });
  });

  it('メソッドの中の処理(Fragmentの中身)は含めない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const method = request.files[0]?.classes[0]?.methods[0];
    expect(method).not.toHaveProperty('fragments');
  });

  it('行数の違反があるファイルには、その減点がdeductionPointsに入る', () => {
    // Arrange
    const codebase = sampleCodebase();
    const stage = { ...LOOSE_STAGE, limits: { method: 20, class: 100, file: 100 } };
    const score = scoreCodebase(codebase, stage);

    // Act
    const request = buildCritiqueRequest(codebase, stage, score);

    // Assert
    const orderFile = request.files.find((file) => file.path === 'src/OrderService.ts');
    const taxFile = request.files.find((file) => file.path === 'src/TaxCalculator.ts');
    expect(orderFile?.deductionPoints).toBe(10);
    // TaxCalculator には行数の減点は入らず、空のクラスの10点だけが入る
    expect(taxFile?.deductionPoints).toBe(10);
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
    const orderClass = request.files.find((file) => file.path === 'src/OrderService.ts')?.classes[0];
    expect(orderClass?.superclassName).toBe('TaxCalculator');
    expect(orderClass?.interfaceNames).toBeUndefined();
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
    const orderClass = request.files.find((file) => file.path === 'src/OrderService.ts')?.classes[0];
    expect(orderClass?.interfaceNames).toEqual(['TaxCalculator']);
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

  it('通常のメソッドにはstubキーを含めない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const method = request.files[0]?.classes[0]?.methods[0];
    expect(method).not.toHaveProperty('stub');
  });

  it('継承元・実装先がなければ何も含めない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, LOOSE_STAGE);

    // Act
    const request = buildCritiqueRequest(codebase, LOOSE_STAGE, score);

    // Assert
    const orderClass = request.files.find((file) => file.path === 'src/OrderService.ts')?.classes[0];
    expect(orderClass?.superclassName).toBeUndefined();
    expect(orderClass?.interfaceNames).toBeUndefined();
  });
});
