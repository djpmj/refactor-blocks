import { describe, expect, it } from 'vitest';
import { changePart, withChangePart } from '../../domain/change/changePart';
import { allClasses } from '../../domain/codebase/Codebase';
import { moveMethod } from '../../domain/codebase/moveMethod';
import { sampleImplementation } from '../../domain/change/sampleImplementation';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { createGameStore } from './useGameStore';

const ghost = { kind: 'method' as const, methodId: 'method-example', toClassId: 'class-example' };

describe('change-request lifecycle and ghost state', () => {
  it('clears the active ghost when a change request starts', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.setState({ ghost });
    // Act
    store.getState().startChangeRequests();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });

  it('clears the active ghost when implementation advances', () => {
    // Arrange
    const stage = stages[0];
    const request = stage.changeRequests[0];
    const sample = sampleImplementation(stage.codebase, request);
    if (sample === undefined || sample.target.kind !== 'existing-class') throw new Error('An existing-class sample placement is required');
    const targetName = sample.target.className;
    const target = allClasses(stage.codebase).find((item) => item.name === targetName);
    if (target === undefined) throw new Error('The sample target class is required');
    const placed = moveMethod(withChangePart(stage.codebase, request), changePart(request).id, target.id);
    if (!placed.ok) throw new Error('The sample part should be placeable');
    const store = createGameStore([stage], false);
    store.getState().startChangeRequests();
    store.setState({ codebase: placed.value });
    store.setState({ ghost });
    // Act
    store.getState().finishImplementation();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });

  it('clears the active ghost when change requests end', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startChangeRequests();
    store.setState({ ghost });
    // Act
    store.getState().endChangeRequests();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });
});
