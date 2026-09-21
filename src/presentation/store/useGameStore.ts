import { create } from 'zustand';
import { evaluateChangeRequestUseCase, type ChangeOutcome } from '../../application/ChangeRequestUseCases';
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

/** 変更依頼に挑戦中の状態。調査中はコードベースを編集できず、依頼を1件ずつ片付ける。 */
export type ChangeSession = {
  /** 今の依頼の番号(0始まり)。 */
  readonly index: number;
  /** 今の依頼で「変更が必要」と選んだメソッドのID。 */
  readonly selected: readonly string[];
  /** 何をするメソッドか確かめるために、カーソルを合わせた(フォーカスした)メソッドのID。 */
  readonly inspected: string | null;
  readonly outcomes: readonly ChangeOutcome[];
};

/** 直前に終えた変更依頼の結果。リファクタリングに戻ったあとも、どこを直せばよいかの手がかりとして残す。 */
export type ChangeReport = {
  readonly outcomes: readonly ChangeOutcome[];
  /** 減点の理由(波及したクラスの名前など)を組み立てるための、挑戦した時点のコードベース。 */
  readonly codebase: Codebase;
};

type GameState = {
  stages: readonly Stage[];
  stage: Stage;
  codebase: Codebase;
  history: History;
  selectedMethodId: string | null;
  message: string | null;
  changeSession: ChangeSession | null;
  lastChangeReport: ChangeReport | null;
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
  startChangeRequests: () => void;
  toggleInvestigated: (methodId: string) => void;
  inspectMethod: (methodId: string) => void;
  finishInvestigation: () => void;
  endChangeRequests: () => void;
  resetStage: () => void;
  selectStage: (stageId: string) => void;
};

const [firstStage] = stages;

/** コードベースが変わったときだけ、変更前のものを履歴に積んで差し替える。何も変わらない操作は1手に数えない。 */
function commit(state: GameState, codebase: Codebase): Partial<GameState> {
  // 変更依頼の調査中は、調べているコードが変わらないよう編集を受け付けない
  if (codebase === state.codebase || state.changeSession !== null) return {};
  return { codebase, history: recordChange(state.history, state.codebase) };
}

/** 操作の結果を状態の更新にする。成功したらコードベースを差し替え、失敗したら理由を出す。 */
function applyResult<E>(state: GameState, result: Result<Codebase, E>, describe: (error: E) => string): Partial<GameState> {
  if (state.changeSession !== null) return { message: '変更依頼の調査中は編集できません' };
  return result.ok ? { ...commit(state, result.value), message: null } : { message: describe(result.error) };
}

/** 取り消し・やり直しの結果を状態にする。選択中のメソッドがなくなっていたら選択を外す。 */
function travelTo(state: GameState, travel: Travel | undefined): Partial<GameState> {
  if (travel === undefined || state.changeSession !== null) return {};
  const { codebase, history } = travel;
  const stillThere = state.selectedMethodId !== null && findMethod(codebase, state.selectedMethodId) !== undefined;
  return { codebase, history, selectedMethodId: stillThere ? state.selectedMethodId : null, message: null };
}

function toggleInvestigated(state: GameState, methodId: string): Partial<GameState> {
  const session = state.changeSession;
  if (session === null) return {};
  const selected = session.selected.includes(methodId)
    ? session.selected.filter((id) => id !== methodId)
    : [...session.selected, methodId];
  return { changeSession: { ...session, selected } };
}

/** 今の依頼を評価して結果に積み、次の依頼へ進む。 */
function finishInvestigation(state: GameState): Partial<GameState> {
  const session = state.changeSession;
  const request = session === null ? undefined : state.stage.changeRequests[session.index];
  if (session === null || request === undefined) return {};
  const result = evaluateChangeRequestUseCase(state.stage, state.codebase, request, session.selected);
  if (!result.ok) return { message: 'この依頼で変更が必要な場所が見つかりません' };
  return { changeSession: { index: session.index + 1, selected: [], inspected: null, outcomes: [...session.outcomes, result.value] }, message: null };
}

function historyActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'undo' | 'redo'> {
  return {
    undo: () => {
      set(travelTo(get(), undoHistory(get().history, get().codebase)));
    },
    redo: () => {
      set(travelTo(get(), redoHistory(get().history, get().codebase)));
    },
  };
}

function changeSessionActions(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'startChangeRequests' | 'toggleInvestigated' | 'inspectMethod' | 'finishInvestigation' | 'endChangeRequests'> {
  return {
    startChangeRequests: () => {
      set({ changeSession: { index: 0, selected: [], inspected: null, outcomes: [] }, selectedMethodId: null, message: null });
    },
    toggleInvestigated: (methodId) => {
      set(toggleInvestigated(get(), methodId));
    },
    inspectMethod: (methodId) => {
      const { changeSession } = get();
      if (changeSession !== null) set({ changeSession: { ...changeSession, inspected: methodId } });
    },
    finishInvestigation: () => {
      set(finishInvestigation(get()));
    },
    endChangeRequests: () => {
      const { changeSession, codebase, lastChangeReport } = get();
      const outcomes = changeSession === null ? [] : changeSession.outcomes;
      set({ changeSession: null, message: null, lastChangeReport: outcomes.length > 0 ? { outcomes, codebase } : lastChangeReport });
    },
  };
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
    changeSession: null,
    lastChangeReport: null,
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
    ...historyActions(set, get),
    ...changeSessionActions(set, get),
    // 「最初に戻す」も1手として記録し、取り消しで戻せるようにする
    resetStage: () => {
      set({ ...commit(get(), get().stage.codebase), selectedMethodId: null, message: null });
    },
    selectStage: (stageId) => {
      const stage = stages.find((candidate) => candidate.id === stageId);
      if (stage !== undefined) set({ stage, codebase: stage.codebase, history: emptyHistory(), selectedMethodId: null, message: null, changeSession: null, lastChangeReport: null });
    },
  };
});
