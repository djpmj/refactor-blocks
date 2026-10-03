import { describe, expect, it } from 'vitest';
import { withChangePart } from '../../domain/change/changePart';
import { findChangeSites } from '../../domain/change/findChangeSites';
import { measurePlacement } from '../../domain/change/measurePlacement';
import { scorePlacement } from '../../domain/change/scorePlacement';
import { allClasses, findClassOfMethod, isAbstractLike } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';
import { scoreCodebase } from '../../domain/scoring/score';
import { findVisibilityViolations } from '../../domain/scoring/visibility';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-template-method');
if (stage === undefined) throw new Error('上級8がありません');
const solution = sampleAnswerSteps[stage.id];
if (solution === undefined) throw new Error('上級8の模範解答がありません');

describe('上級8: Template Method', () => {
  it('上級の末尾にあり、初期状態は行数と依存本数の超過で100点未満', () => {
    // Arrange / Act
    const score = scoreCodebase(stage.codebase, stage);
    // Assert
    expect(stages.filter((item) => item.level === 'advanced').at(-1)?.id).toBe(stage.id);
    expect(score.total).toBeLessThan(100);
    expect(score.deductions.find((item) => item.rule === 'line-limit')?.count).toBeGreaterThan(0);
    expect(score.deductions.find((item) => item.rule === 'coupling')?.count).toBeGreaterThan(0);
  });

  it('模範解答は100点、Controller→OrderImporter の1本のみで循環・可視性違反なし', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act / Assert
    expect(scoreCodebase(solved, stage).total).toBe(100);
    expect(classDependencies(solved)).toEqual([{ from: 'class-import-controller', to: 'class-order-importer', cyclic: false }]);
    expect(findVisibilityViolations(solved)).toEqual([]);
    for (const base of [stage.codebase, solved]) {
      expect(allClasses(base).filter(isAbstractLike).map((owner) => owner.name)).toEqual(['OrderImporter']);
    }
    for (const name of ['CsvOrderImporter', 'JsonOrderImporter']) {
      expect(allClasses(solved).find((owner) => owner.name === name)?.methods.map((method) => method.name)).toEqual(['parse']);
    }
  });

  it('XML用の子クラスに部品を置くだけで既存修正0・abstract・置き方100点', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    const request = stage.changeRequests[0];
    const implemented = applySolutionSteps(withChangePart(solved, request), [
      { addFile: 'src/order/XmlOrderImporter.ts' },
      { addClass: { name: 'XmlOrderImporter', file: 'src/order/XmlOrderImporter.ts' } },
      { move: { method: 'parse', fromClass: '部品置き場', toClass: 'XmlOrderImporter' } },
      { setSuperclass: { class: 'XmlOrderImporter', superclass: 'OrderImporter' } },
    ]);
    // Act
    const result = measurePlacement(solved, implemented, request);
    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.modifiedClassIds).toEqual([]);
    expect(result.value.attachment).toBe('abstract');
    expect(scorePlacement(result.value, 'extend').total).toBe(100);
  });

  it('検証ルールの変更箇所は2か所からOrderImporterの1か所になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    const request = stage.changeRequests[1];
    // Act
    const sites = findChangeSites(solved, request);
    // Assert
    expect(findChangeSites(stage.codebase, request)).toHaveLength(2);
    expect(sites).toHaveLength(1);
    expect(findClassOfMethod(solved, sites[0])?.name).toBe('OrderImporter');
  });
});
