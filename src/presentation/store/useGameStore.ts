import { create } from 'zustand';
import { findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { emptyHistory, recordChange, redoHistory, undoHistory, type History, type Travel } from '../../domain/codebase/history';
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
  history: History;
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
  undo: () => void;
  redo: () => void;
  resetStage: () => void;
  selectStage: (stageId: string) => void;
};

const [firstStage] = stages;

/** コードベースが変わったときだけ、変更前のものを履歴に積んで差し替える。何も変わらない操作は1手に数えない。 */
function commit(state: GameState, codebase: Codebase): Partial<GameState> {
  if (codebase === state.codebase) return {};
  return { codebase, history: recordChange(state.history, state.codebase) };
}

/** 操作の結果を状態の更新にする。成功したらコードベースを差し替え、失敗したら理由を出す。 */
function applyResult<E>(state: GameState, result: Result<Codebase, E>, describe: (error: E) => string): Partial<GameState> {
  return result.ok ? { ...commit(state, result.value), message: null } : { message: describe(result.error) };
}

/** 取り消し・やり直しの結果を状態にする。選択中のメソッドがなくなっていたら選択を外す。 */
function travelTo(state: GameState, travel: Travel | undefined): Partial<GameState> {
  if (travel === undefined) return {};
  const { codebase, history } = travel;
  const stillThere = state.selectedMethodId !== null && findMethod(codebase, state.selectedMethodId) !== undefined;
  return { codebase, history, selectedMethodId: stillThere ? state.selectedMethodId : null, message: null };
}

export const useGameStore = create<GameState>((set, get) => {
  /** 操作の結果を反映し、成功したかを返す。 */
  const apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string): boolean => {
    set(applyResult(get(), result, describe));
    return result.ok;
  };
  return {
    stages,
    stage: firstStage,
    codebase: firstStage.codebase,
    history: emptyHistory(),
    selectedMethodId: null,
    message: null,
    selectMethod: (methodId) => {
      set({ selectedMethodId: methodId, message: null });
    },
    moveMethod: (methodId, targetClassId) => {
      apply(moveMethodUseCase(get().codebase, methodId, targetClassId), describeMoveError);
    },
    extractMethod: (input) => {
      return apply(extractMethodUseCase(get().codebase, input, () => crypto.randomUUID()), describeExtractError);
    },
    inlineMethod: (methodId) => {
      const result = inlineMethodUseCase(get().codebase, methodId);
      set(
        result.ok
          ? { ...commit(get(), result.value.codebase), selectedMethodId: result.value.callerId, message: null }
          : { message: describeInlineError(result.error) },
      );
    },
    addClass: (fileId, className) => {
      return apply(addClassUseCase(get().codebase, fileId, className, () => crypto.randomUUID()), describeAddClassError);
    },
    addFile: (path) => {
      return apply(addFileUseCase(get().codebase, path, () => crypto.randomUUID()), describeAddFileError);
    },
    moveClass: (classId, targetFileId) => {
      apply(moveClassUseCase(get().codebase, classId, targetFileId), describeMoveClassError);
    },
    renameClass: (classId, newName) => {
      return apply(renameClassUseCase(get().codebase, classId, newName), describeRenameClassError);
    },
    renameFile: (fileId, newPath) => {
      return apply(renameFileUseCase(get().codebase, fileId, newPath), describeRenameFileError);
    },
    undo: () => {
      set(travelTo(get(), undoHistory(get().history, get().codebase)));
    },
    redo: () => {
      set(travelTo(get(), redoHistory(get().history, get().codebase)));
    },
    // 「最初に戻す」も1手として記録し、取り消しで戻せるようにする
    resetStage: () => {
      set({ ...commit(get(), get().stage.codebase), selectedMethodId: null, message: null });
    },
    selectStage: (stageId) => {
      const stage = stages.find((candidate) => candidate.id === stageId);
      if (stage !== undefined) set({ stage, codebase: stage.codebase, history: emptyHistory(), selectedMethodId: null, message: null });
    },
  };
});
