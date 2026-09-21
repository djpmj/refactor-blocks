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
  describeRenameClassError,
  describeRenameFileError,
  extractMethodUseCase,
  inlineMethodUseCase,
  moveClassUseCase,
  moveMethodUseCase,
  renameClassUseCase,
  renameFileUseCase,
  type ExtractMethodInput,
} from '../../application/RefactorUseCases';
import type { Result } from '../../domain/shared/Result';
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
  renameClass: (classId: string, newName: string) => boolean;
  renameFile: (fileId: string, newPath: string) => boolean;
  resetStage: () => void;
  selectStage: (stageId: string) => void;
};

const [firstStage] = stages;

/** 操作の結果を状態の更新にする。成功したらコードベースを差し替え、失敗したら理由を出す。 */
function applyResult<E>(result: Result<Codebase, E>, describe: (error: E) => string): Partial<GameState> {
  return result.ok ? { codebase: result.value, message: null } : { message: describe(result.error) };
}

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
    set(applyResult(result, describeMoveError));
  },
  extractMethod: (input) => {
    const result = extractMethodUseCase(get().codebase, input, () => crypto.randomUUID());
    set(applyResult(result, describeExtractError));
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
    set(applyResult(result, describeAddClassError));
    return result.ok;
  },
  addFile: (path) => {
    const result = addFileUseCase(get().codebase, path, () => crypto.randomUUID());
    set(applyResult(result, describeAddFileError));
    return result.ok;
  },
  moveClass: (classId, targetFileId) => {
    const result = moveClassUseCase(get().codebase, classId, targetFileId);
    set(applyResult(result, describeMoveClassError));
  },
  renameClass: (classId, newName) => {
    const result = renameClassUseCase(get().codebase, classId, newName);
    set(applyResult(result, describeRenameClassError));
    return result.ok;
  },
  renameFile: (fileId, newPath) => {
    const result = renameFileUseCase(get().codebase, fileId, newPath);
    set(applyResult(result, describeRenameFileError));
    return result.ok;
  },
  resetStage: () => {
    set({ codebase: get().stage.codebase, selectedMethodId: null, message: null });
  },
  selectStage: (stageId) => {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (stage !== undefined) set({ stage, codebase: stage.codebase, selectedMethodId: null, message: null });
  },
}));
