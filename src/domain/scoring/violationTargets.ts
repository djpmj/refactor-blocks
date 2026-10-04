import { findClassOfField, findClassOfMethod, type Codebase } from '../codebase/Codebase';
import { classDependencies } from '../codebase/dependencies';
import type { Stage } from '../stage/Stage';
import { findLowCohesionClasses } from './cohesion';
import { findEncapsulationViolations, findFeatureEnvy, findOpenSetters } from './fieldAccess';
import { findContractViolations, findStubMethods } from './interfaceContracts';
import { findEmptyContainers, findUnusedPrivateMethods } from './leftovers';
import { findLineLimitViolations } from './lineLimits';
import { findLayerViolations } from './layers';
import { findLoneSuperclasses } from './loneSuperclass';
import { findResponsibilityViolations } from './responsibilities';
import { findThinClasses, findTrivialMethods } from './overExtraction';
import { findCouplingViolations, type ScoreRule } from './score';
import { countedVisibilityViolations } from './visibility';

/** 同一ブロックに複数の違反があっても、強調対象IDは一度だけ返す。 */
export type ViolationTarget = {
  readonly fileIds: readonly string[];
  readonly classIds: readonly string[];
  readonly methodIds: readonly string[];
};

type MutableTarget = { fileIds: Set<string>; classIds: Set<string>; methodIds: Set<string> };
type TargetRecord = Record<ScoreRule, MutableTarget>;

function emptyTarget(): MutableTarget {
  return { fileIds: new Set(), classIds: new Set(), methodIds: new Set() };
}

function emptyTargets(): TargetRecord {
  return {
    'line-limit': emptyTarget(), coupling: emptyTarget(), cycle: emptyTarget(), responsibility: emptyTarget(),
    visibility: emptyTarget(), empty: emptyTarget(), unused: emptyTarget(), 'lone-superclass': emptyTarget(),
    stub: emptyTarget(), contract: emptyTarget(), 'feature-envy': emptyTarget(), encapsulation: emptyTarget(),
    cohesion: emptyTarget(), 'trivial-method': emptyTarget(), 'thin-class': emptyTarget(),
    layer: emptyTarget(),
  };
}

function addClasses(target: MutableTarget, classIds: readonly string[]): void {
  for (const id of classIds) target.classIds.add(id);
}

function addMethods(target: MutableTarget, methodIds: readonly string[]): void {
  for (const id of methodIds) target.methodIds.add(id);
}

function freezeTarget(target: MutableTarget): ViolationTarget {
  return { fileIds: [...target.fileIds], classIds: [...target.classIds], methodIds: [...target.methodIds] };
}

function freezeTargets(targets: TargetRecord): Record<ScoreRule, ViolationTarget> {
  return {
    'line-limit': freezeTarget(targets['line-limit']), coupling: freezeTarget(targets.coupling),
    cycle: freezeTarget(targets.cycle), responsibility: freezeTarget(targets.responsibility),
    visibility: freezeTarget(targets.visibility), empty: freezeTarget(targets.empty), unused: freezeTarget(targets.unused),
    'lone-superclass': freezeTarget(targets['lone-superclass']), stub: freezeTarget(targets.stub),
    contract: freezeTarget(targets.contract), 'feature-envy': freezeTarget(targets['feature-envy']),
    encapsulation: freezeTarget(targets.encapsulation), cohesion: freezeTarget(targets.cohesion),
    'trivial-method': freezeTarget(targets['trivial-method']), 'thin-class': freezeTarget(targets['thin-class']),
    layer: freezeTarget(targets.layer),
  };
}

function addLineLimitTargets(codebase: Codebase, stage: Pick<Stage, 'limits'>, target: MutableTarget): void {
  for (const violation of findLineLimitViolations(codebase, stage.limits)) {
    if (violation.kind === 'method') target.methodIds.add(violation.targetId);
    else if (violation.kind === 'class') target.classIds.add(violation.targetId);
    else target.fileIds.add(violation.targetId);
  }
}

function addEmptyTargets(codebase: Codebase, target: MutableTarget): void {
  const fileIds = new Set(codebase.files.map((file) => file.id));
  for (const id of findEmptyContainers(codebase)) {
    if (fileIds.has(id)) target.fileIds.add(id);
    else target.classIds.add(id);
  }
}

export function violationTargets(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced' | 'layers'>,
): Record<ScoreRule, ViolationTarget> {
  const targets = emptyTargets();
  const dependencies = classDependencies(codebase);
  addLineLimitTargets(codebase, stage, targets['line-limit']);
  addClasses(targets.coupling, findCouplingViolations(dependencies, stage.dependencyLimit));
  addClasses(targets.cycle, dependencies.filter((dependency) => dependency.cyclic).map(({ from }) => from));
  addClasses(targets.responsibility, findResponsibilityViolations(codebase, stage.responsibilityLimit).map(({ classId }) => classId));
  addMethods(targets.visibility, countedVisibilityViolations(codebase, stage.visibilityEnforced).map(({ methodId }) => methodId));
  addEmptyTargets(codebase, targets.empty);
  addMethods(targets.unused, findUnusedPrivateMethods(codebase));
  addClasses(targets['lone-superclass'], findLoneSuperclasses(codebase));
  addMethods(targets.stub, findStubMethods(codebase));
  addClasses(targets.contract, findContractViolations(codebase));
  addMethods(targets['feature-envy'], findFeatureEnvy(codebase).map(({ methodId }) => methodId));
  for (const violation of findEncapsulationViolations(codebase)) {
    const owner = findClassOfField(codebase, violation.fieldId);
    if (owner !== undefined) targets.encapsulation.classIds.add(owner.id);
  }
  for (const methodId of findOpenSetters(codebase)) {
    const owner = findClassOfMethod(codebase, methodId);
    if (owner !== undefined) targets.encapsulation.classIds.add(owner.id);
  }
  addClasses(targets.cohesion, findLowCohesionClasses(codebase).map(({ classId }) => classId));
  addMethods(targets['trivial-method'], findTrivialMethods(codebase));
  addClasses(targets['thin-class'], findThinClasses(codebase));
  addClasses(targets.layer, findLayerViolations(codebase, stage.layers).map(({ fromClassId }) => fromClassId));
  return freezeTargets(targets);
}
