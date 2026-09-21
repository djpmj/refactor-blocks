import { create } from 'zustand';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { Stage } from '../../domain/stage/Stage';
import {
  addClassUseCase,
  addFileUseCase,
  describeAddClassError,
  describeAddFileError,
  describeMoveClassError,
  describeExtractError,
  describeInlineError,
  describeMoveError,
  extractMethodUseCase,
  inlineMethodUseCase,
  moveClassUseCase,
  moveMethodUseCase,
  type ExtractMethodInput,
} from '../../application/RefactorUseCases';
import { stages } from '../../infrastructure/stages/stageCatalog';

type GameState = {
  stages: readonly Stage[];
  stage: Stage;
  codebase: Codebase;
  selectedMethodId: string | null;
  message: string | null;
  selectMethod: (methodId: string | null) => void;
  moveMethod: (methodId: string, targetClassId: string) => void;
  extractMethod: (input: ExtractMethodInput) => boolean;
  inlineMethod: (methodId: string) => void;
  addClass: (fileId: string, className: string) => boolean;
  addFile: (path: string) => boolean;
  moveClass: (classId: string, targetFileId: string) => void;
  resetStage: () => void;
  selectStage: (stageId: string) => void;
};

const [firstStage] = stages;

export const useGameStore = create<GameState>((set, get) => ({
  stages,
  stage: firstStage,
  codebase: firstStage.codebase,
  selectedMethodId: null,
  message: null,
  selectMethod: (methodId) => {
    set({ selectedMethodId: methodId, message: null });
  },
  moveMethod: (methodId, targetClassId) => {
    const result = moveMethodUseCase(get().codebase, methodId, targetClassId);
    set(result.ok ? { codebase: result.value, message: null } : { message: describeMoveError(result.error) });
  },
  extractMethod: (input) => {
    const result = extractMethodUseCase(get().codebase, input, () => crypto.randomUUID());
    set(result.ok ? { codebase: result.value, message: null } : { message: describeExtractError(result.error) });
    return result.ok;
  },
  inlineMethod: (methodId) => {
    const result = inlineMethodUseCase(get().codebase, methodId);
    set(
      result.ok
        ? { codebase: result.value.codebase, selectedMethodId: result.value.callerId, message: null }
        : { message: describeInlineError(result.error) },
    );
  },
  addClass: (fileId, className) => {
    const result = addClassUseCase(get().codebase, fileId, className, () => crypto.randomUUID());
    set(result.ok ? { codebase: result.value, message: null } : { message: describeAddClassError(result.error) });
    return result.ok;
  },
  addFile: (path) => {
    const result = addFileUseCase(get().codebase, path, () => crypto.randomUUID());
    set(result.ok ? { codebase: result.value, message: null } : { message: describeAddFileError(result.error) });
    return result.ok;
  },
  moveClass: (classId, targetFileId) => {
    const result = moveClassUseCase(get().codebase, classId, targetFileId);
    set(result.ok ? { codebase: result.value, message: null } : { message: describeMoveClassError(result.error) });
  },
  resetStage: () => {
    set({ codebase: get().stage.codebase, selectedMethodId: null, message: null });
  },
  selectStage: (stageId) => {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (stage !== undefined) set({ stage, codebase: stage.codebase, selectedMethodId: null, message: null });
  },
}));
