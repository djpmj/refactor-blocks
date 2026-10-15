import { describe, expect, it } from 'vitest';
import { allClasses, isInterfaceLike, type Codebase } from '../../domain/codebase/Codebase';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { usesInheritance } from './usesInheritance';

function hasSuperclass(codebase: Codebase): boolean {
  return allClasses(codebase).some((codeClass) => codeClass.superclassId !== undefined);
}

function hasInheritanceConcept(codebase: Codebase): boolean {
  return allClasses(codebase).some((codeClass) => codeClass.superclassId !== undefined || isInterfaceLike(codeClass));
}

describe('usesInheritance', () => {
  it('チュートリアル2は false', () => {
    const stage = stages.find((candidate) => candidate.id === 'tutorial-order-service');
    expect(stage).toBeDefined();
    if (stage === undefined) throw new Error('tutorial-order-service がありません');
    expect(usesInheritance(stage)).toBe(false);
  });

  it('上級ステージは継承またはインターフェースを含むため true', () => {
    const stage = stages.find((candidate) => candidate.level === 'advanced');
    expect(stage).toBeDefined();
    if (stage === undefined) throw new Error('上級ステージがありません');
    expect(usesInheritance(stage)).toBe(true);
  });

  it('初期コードに superclass がある場合は true', () => {
    const stage = stages.find((candidate) => hasSuperclass(candidate.codebase));
    expect(stage).toBeDefined();
    if (stage === undefined) throw new Error('初期コードに継承があるステージがありません');
    expect(usesInheritance(stage)).toBe(true);
  });

  it('初期コードに継承もinterface-like classもなく、解答例にだけinterface-like classがある場合は true', () => {
    const stage = stages.find((candidate) => candidate.id === 'tutorial-order-service');
    expect(stage).toBeDefined();
    if (stage === undefined) throw new Error('tutorial-order-service がありません');
    const sampleAnswer: Codebase = {
      files: [{
        id: 'file-sample-interface',
        path: 'sample-interface.ts',
        classes: [{
          id: 'class-sample-interface',
          name: 'SampleInterface',
          methods: [{ id: 'method-sample-contract', name: 'execute', visibility: 'public', fragments: [] }],
        }],
      }],
    };
    expect(hasInheritanceConcept(stage.codebase)).toBe(false);
    expect(usesInheritance(stage, sampleAnswer)).toBe(true);
  });
});
