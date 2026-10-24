import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase } from '../codebase/Codebase';
import { violationDependencies } from './violationDependencies';

const LAYERS = [
  { name: 'Controller', responsibilities: ['http'] },
  { name: 'Service', responsibilities: ['rule'] },
  { name: 'Repository', responsibilities: ['persistence'] },
];
const STAGE = { dependencyLimit: 10, layers: LAYERS };

function codebaseWith(controllerUses: readonly string[]): Codebase {
  return { files: [{ id: 'file', path: 'app.ts', classes: [
    { id: 'controller', name: 'OrderController', methods: [{ id: 'save', name: 'save', visibility: 'public', fragments: [{ id: 'f1', label: '受け取る', lines: 1, responsibility: 'http', uses: controllerUses }] }] },
    { id: 'service', name: 'OrderService', methods: [{ id: 'place', name: 'place', visibility: 'public', fragments: [{ id: 'f2', label: '決める', lines: 1, responsibility: 'rule' }] }] },
    { id: 'repository', name: 'OrderRepository', methods: [{ id: 'store', name: 'store', visibility: 'public', fragments: [{ id: 'f3', label: '保存する', lines: 1, responsibility: 'persistence' }] }] },
  ] }] };
}

function withUses(codeClass: CodeClass, uses: readonly string[]): CodeClass {
  return { ...codeClass, methods: [{ ...codeClass.methods[0], fragments: [{ ...codeClass.methods[0].fragments[0], uses }] }] };
}

describe('violationDependencies', () => {
  it('層を飛ばした依存を layer の違反として from → to で返す', () => {
    // Arrange
    const codebase = codebaseWith(['store']);

    // Act
    const result = violationDependencies(codebase, STAGE);

    // Assert
    expect(result.layer).toEqual([{ from: 'controller', to: 'repository' }]);
  });

  it('違反がなければすべて空を返す', () => {
    // Arrange
    const codebase = codebaseWith(['place']);

    // Act
    const result = violationDependencies(codebase, { ...STAGE, layers: undefined });

    // Assert
    expect(result).toEqual({ coupling: [], cycle: [], layer: [] });
  });

  it('循環している依存を cycle として返す', () => {
    // Arrange
    const codebase = codebaseWith(['place']);
    const cyclic: Codebase = { files: [{ ...codebase.files[0], classes: codebase.files[0].classes.map((codeClass) => {
      if (codeClass.id === 'service') return withUses(codeClass, ['store']);
      return codeClass.id === 'repository' ? withUses(codeClass, ['place']) : codeClass;
    }) }] };

    // Act
    const result = violationDependencies(cyclic, STAGE);

    // Assert
    expect(result.cycle).toEqual([{ from: 'service', to: 'repository' }, { from: 'repository', to: 'service' }]);
  });

  it('依存の数が上限を超えたクラスの依存を coupling として返す', () => {
    // Arrange
    const codebase = codebaseWith(['place', 'store']);

    // Act
    const result = violationDependencies(codebase, { ...STAGE, dependencyLimit: 1 });

    // Assert
    expect(result.coupling).toEqual([{ from: 'controller', to: 'service' }, { from: 'controller', to: 'repository' }]);
  });
});
