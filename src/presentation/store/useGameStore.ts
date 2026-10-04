import { createContext, useContext, type Context } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { evaluateImplementationUseCase, type ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { describeCritiqueError, requestCritiqueUseCase } from '../../application/CritiqueUseCases';
import { withoutTray } from '../../domain/blank/tray';
import { withChangePart } from '../../domain/change/changePart';
import { findMethod, type Codebase, type Visibility } from '../../domain/codebase/Codebase';
import { emptyHistory, recordChange, redoHistory, undoHistory, type History, type Travel } from '../../domain/codebase/history';
import { scoreCodebase } from '../../domain/scoring/score';
import type { Stage } from '../../domain/stage/Stage';
import { fetchCritique } from '../../infrastructure/critique/critiqueClient';
import {
  addClassUseCase,
  addNewFileUseCase,
  addInterfaceUseCase,
  deleteClassUseCase,
  deleteFileUseCase,
  deleteMethodUseCase,
  describeAddClassError,
  describeAddInterfaceError,
  describeDeleteClassError,
  describeDeleteFileError,
  describeDeleteMethodError,
  describeMoveClassError,
  describeExtractError,
  describeInlineError,
  describeMergeError,
  describeMoveError,
  describeMoveFieldError,
  describeRemoveInterfaceError,
  describeRenameClassError,
  describeRenameMethodError,
  extractMethodUseCase,
  inlineMethodUseCase,
  mergeMethodsUseCase,
  describeMoveOutError,
  moveClassToNewFileUseCase,
  moveClassUseCase,
  moveFieldUseCase,
  moveMethodToNewClassUseCase,
  moveMethodToNewClassInFileUseCase,
  moveMethodUseCase,
  removeInterfaceUseCase,
  renameClassUseCase,
  renameMethodUseCase,
  describeSetSuperclassError,
  setSuperclassUseCase,
  changeVisibilityUseCase,
  describeChangeVisibilityError,
  type ExtractMethodInput,
  type MergeMethodsInput,
} from '../../application/RefactorUseCases';
import type { Result } from '../../domain/shared/Result';
import { stages } from '../../infrastructure/stages/stageCatalog';
import type { Progress } from '../../domain/progress/Progress';
import { updateProgress } from '../../domain/progress/updateProgress';
import { loadProgress, saveProgress } from '../../infrastructure/progress/progressStorage';

/** 変更依頼に挑戦中の状態。依頼ごとに部品を足したコードで実装し、依頼を1件ずつ片付ける。 */
export type ChangeSession = {
  /** 今の依頼の番号(0始まり)。 */
  readonly index: number;
  /** 何をするメソッドか確かめるために、カーソルを合わせた(フォーカスした)メソッドのID。 */
  readonly inspected: string | null;
  readonly outcomes: readonly ChangeOutcome[];
  /** 挑戦前のコード。挑戦を終えたらここへ戻す(依頼の実装は積み重ねるが、挑戦後には持ち越さない)。 */
  readonly base: Codebase;
  /** 今の依頼を始める前のコード。base に、前の依頼までの実装(部品置き場は除く)を積み重ねたもの。次の依頼はここへ部品置き場を足して始める。 */
  readonly carried: Codebase;
  /** 挑戦前の取り消し履歴。挑戦を終えたら戻す。 */
  readonly baseHistory: History;
};

/** 直前に終えた変更依頼の結果。リファクタリングに戻ったあとも、どこを直せばよいかの手がかりとして残す。 */
export type ChangeReport = {
  readonly outcomes: readonly ChangeOutcome[];
  /** 減点の理由(波及したクラスの名前など)を組み立てるための、挑戦の最後の時点のコードベース(前の依頼で作ったクラスの名前も引けるよう、実装を積み重ねたもの)。 */
  readonly codebase: Codebase;
};

/** AI講評の状態。ステージを切り替えたら空に戻す(別ステージの講評が残らないようにする)。 */
export type CritiqueState = {
  readonly text: string | null;
  readonly loading: boolean;
  readonly error: string | null;
};

const EMPTY_CRITIQUE: CritiqueState = { text: null, loading: false, error: null };

type GameState = {
  stages: readonly Stage[];
  stage: Stage;
  codebase: Codebase;
  history: History;
  selectedMethodId: string | null;
  message: string | null;
  changeSession: ChangeSession | null;
  lastChangeReport: ChangeReport | null;
  critique: CritiqueState;
  requestCritique: () => void;
  selectMethod: (methodId: string | null) => void;
  moveMethod: (methodId: string, targetClassId: string) => void;
  moveField: (fieldId: string, targetClassId: string) => void;
  changeVisibility: (methodId: string, visibility: Visibility) => void;
  extractMethod: (input: ExtractMethodInput) => boolean;
  mergeMethods: (methodAId: string, methodBId: string, newMethodName: string) => boolean;
  inlineMethod: (methodId: string) => void;
  addClass: (fileId: string, className: string) => boolean;
  addFile: () => void;
  moveClass: (classId: string, targetFileId: string) => void;
  moveClassToNewFile: (classId: string) => void;
  moveMethodToNewClass: (methodId: string) => void;
  moveMethodToNewClassInFile: (methodId: string, fileId: string) => void;
  renameClass: (classId: string, newName: string) => boolean;
  renameMethod: (methodId: string, newName: string) => boolean;
  setSuperclass: (classId: string, superclassName: string | null) => boolean;
  addInterface: (classId: string, interfaceName: string) => boolean;
  removeInterface: (classId: string, interfaceName: string) => boolean;
  deleteClass: (classId: string) => boolean;
  deleteFile: (fileId: string) => boolean;
  deleteMethod: (methodId: string) => boolean;
  undo: () => void;
  redo: () => void;
  startChangeRequests: () => void;
  inspectMethod: (methodId: string | null) => void;
  finishImplementation: () => void;
  endChangeRequests: () => void;
  resetStage: () => void;
  selectStage: (stageId: string) => void;
  progress: Progress;
  recordProgress: (stageId: string, score: number) => void;
};

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

const UNPLACED_MESSAGE = '部品がまだ部品置き場にあります。置き場所へドラッグしてください';

/** 今の依頼の実装を評価して結果に積み、次の依頼(部品を足した挑戦前のコード)へ進む。全件終えたら挑戦前のコードに戻す。 */
function finishImplementation(state: GameState): Partial<GameState> {
  const session = state.changeSession;
  const request = session === null ? undefined : state.stage.changeRequests[session.index];
  if (session === null || request === undefined) return {};
  const result = evaluateImplementationUseCase(state.stage, session.carried, state.codebase, request);
  if (!result.ok) return { message: result.error === 'unplaced-part' ? UNPLACED_MESSAGE : 'この依頼で変更が必要な場所が見つかりません' };
  const next = state.stage.changeRequests.at(session.index + 1);
  const carried = withoutTray(state.codebase);
  return {
    changeSession: { ...session, index: session.index + 1, inspected: null, outcomes: [...session.outcomes, result.value], carried },
    codebase: next === undefined ? session.base : withChangePart(carried, next),
    history: emptyHistory(),
    selectedMethodId: null,
    message: null,
  };
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
): Pick<GameState, 'startChangeRequests' | 'inspectMethod' | 'finishImplementation' | 'endChangeRequests'> {
  return {
    startChangeRequests: () => {
      const { codebase, history, stage } = get();
      const [first] = stage.changeRequests;
      set({
        changeSession: { index: 0, inspected: null, outcomes: [], base: codebase, carried: codebase, baseHistory: history },
        codebase: withChangePart(codebase, first),
        history: emptyHistory(),
        selectedMethodId: null,
        message: null,
      });
    },
    inspectMethod: (methodId) => {
      const { changeSession } = get();
      if (changeSession !== null) set({ changeSession: { ...changeSession, inspected: methodId } });
    },
    finishImplementation: () => {
      set(finishImplementation(get()));
    },
    endChangeRequests: () => {
      const { changeSession, lastChangeReport } = get();
      if (changeSession === null) return;
      const { outcomes, base, carried, baseHistory } = changeSession;
      set({
        changeSession: null,
        codebase: base,
        history: baseHistory,
        selectedMethodId: null,
        message: null,
        lastChangeReport: outcomes.length > 0 ? { outcomes, codebase: carried } : lastChangeReport,
      });
    },
  };
}

/** AI講評をもらう操作。通信は注入されたinfrastructure層の関数(fetchCritique)が行う。 */
function critiqueActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'requestCritique'> {
  return {
    // ponytail: 講評取得後にコードベースを編集しても、講評は自動では消えない。古い講評だと分かるよう再度ボタンを押してもらう前提
    requestCritique: () => {
      const { codebase, stage } = get();
      const score = scoreCodebase(codebase, stage);
      set({ critique: { text: null, loading: true, error: null } });
      void requestCritiqueUseCase(codebase, stage, score, fetchCritique).then((result) => {
        set({
          critique: result.ok
            ? { text: result.value, loading: false, error: null }
            : { text: null, loading: false, error: describeCritiqueError(result.error) },
        });
      });
    },
  };
}

/** ステージを切り替えたときの状態。見つからないステージIDなら何もしない。 */
function selectStageState(allStages: readonly Stage[], stageId: string): Partial<GameState> | null {
  const stage = allStages.find((candidate) => candidate.id === stageId);
  if (stage === undefined) return null;
  return {
    stage,
    codebase: stage.codebase,
    history: emptyHistory(),
    selectedMethodId: null,
    message: null,
    changeSession: null,
    lastChangeReport: null,
    critique: EMPTY_CRITIQUE,
  };
}

type Apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string) => boolean;

/** クラス・ファイルの名前や継承元・実装先を付け替える操作。 */
function renameActions(
  apply: Apply,
  get: () => GameState,
): Pick<GameState, 'renameClass' | 'renameMethod' | 'setSuperclass' | 'addInterface' | 'removeInterface'> {
  return {
    renameClass: (classId, newName) => {
      return apply(renameClassUseCase(get().codebase, classId, newName), describeRenameClassError);
    },
    renameMethod: (methodId, newName) => {
      return apply(renameMethodUseCase(get().codebase, methodId, newName), describeRenameMethodError);
    },
    setSuperclass: (classId, superclassName) => {
      return apply(setSuperclassUseCase(get().codebase, classId, superclassName), describeSetSuperclassError);
    },
    addInterface: (classId, interfaceName) => {
      return apply(addInterfaceUseCase(get().codebase, classId, interfaceName), describeAddInterfaceError);
    },
    removeInterface: (classId, interfaceName) => {
      return apply(removeInterfaceUseCase(get().codebase, classId, interfaceName), describeRemoveInterfaceError);
    },
  };
}

/** ドラッグ&ドロップによる移動系の操作と、メソッドの可視性を変える操作。 */
function moveActions(
  apply: Apply,
  get: () => GameState,
): Pick<GameState, 'moveMethod' | 'moveField' | 'changeVisibility' | 'moveClass' | 'moveClassToNewFile' | 'moveMethodToNewClass' | 'moveMethodToNewClassInFile'> {
  const newId = () => crypto.randomUUID();
  return {
    moveMethod: (methodId, targetClassId) => {
      apply(moveMethodUseCase(get().codebase, methodId, targetClassId), describeMoveError);
    },
    moveField: (fieldId, targetClassId) => {
      apply(moveFieldUseCase(get().codebase, fieldId, targetClassId), describeMoveFieldError);
    },
    changeVisibility: (methodId, visibility) => {
      const state = get();
      apply(changeVisibilityUseCase(state.codebase, methodId, visibility, state.stage.codebase), describeChangeVisibilityError);
    },
    moveClass: (classId, targetFileId) => {
      apply(moveClassUseCase(get().codebase, classId, targetFileId), describeMoveClassError);
    },
    moveClassToNewFile: (classId) => {
      apply(moveClassToNewFileUseCase(get().codebase, classId, newId), describeMoveOutError);
    },
    moveMethodToNewClass: (methodId) => {
      apply(moveMethodToNewClassUseCase(get().codebase, methodId, newId), describeMoveOutError);
    },
    moveMethodToNewClassInFile: (methodId, fileId) => {
      apply(moveMethodToNewClassInFileUseCase(get().codebase, methodId, fileId, newId), describeMoveOutError);
    },
  };
}

/** クラス・ファイル・空実装メソッドを取り除く操作。 */
function deleteActions(apply: Apply, set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'deleteClass' | 'deleteFile' | 'deleteMethod'> {
  return {
    deleteClass: (classId) => {
      return apply(deleteClassUseCase(get().codebase, classId), describeDeleteClassError);
    },
    deleteFile: (fileId) => {
      return apply(deleteFileUseCase(get().codebase, fileId), describeDeleteFileError);
    },
    deleteMethod: (methodId) => {
      const succeeded = apply(deleteMethodUseCase(get().codebase, methodId), describeDeleteMethodError);
      if (succeeded && get().selectedMethodId === methodId) set({ selectedMethodId: null });
      return succeeded;
    },
  };
}

/** 統合・インライン化など、成功時に選択中メソッドを結果側の別メソッドへ付け替える操作。 */
function replaceMethodActions(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'mergeMethods' | 'inlineMethod'> {
  return {
    mergeMethods: (methodAId, methodBId, newMethodName) => {
      const input: MergeMethodsInput = { methodAId, methodBId, newMethodName };
      const result = mergeMethodsUseCase(get().codebase, input, () => crypto.randomUUID());
      set(
        result.ok
          ? { ...commit(get(), result.value.codebase), selectedMethodId: result.value.newMethodId, message: null }
          : { message: describeMergeError(result.error) },
      );
      return result.ok;
    },
    inlineMethod: (methodId) => {
      const result = inlineMethodUseCase(get().codebase, methodId);
      set(
        result.ok
          ? { ...commit(get(), result.value.codebase), selectedMethodId: result.value.callerId, message: null }
          : { message: describeInlineError(result.error) },
      );
    },
  };
}

export type GameStore = StoreApi<GameState>;

/** stages の先頭のステージから始まるストアを作る。selectStage もこの stages から探す。 */
export function createGameStore(allStages: readonly Stage[]): GameStore {
  const [firstStage] = allStages;
  return createStore<GameState>((set, get) => {
    /** 操作の結果を反映し、成功したかを返す。 */
    const apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string): boolean => {
      set(applyResult(get(), result, describe));
      return result.ok;
    };
    return {
      stages: allStages,
      stage: firstStage,
      codebase: firstStage.codebase,
      history: emptyHistory(),
      selectedMethodId: null,
      message: null,
      changeSession: null,
      lastChangeReport: null,
      critique: EMPTY_CRITIQUE,
      ...critiqueActions(set, get),
      selectMethod: (methodId) => {
        set({ selectedMethodId: methodId, message: null });
      },
      extractMethod: (input) => {
        return apply(extractMethodUseCase(get().codebase, input, () => crypto.randomUUID()), describeExtractError);
      },
      ...replaceMethodActions(set, get),
      addClass: (fileId, className) => {
        return apply(addClassUseCase(get().codebase, fileId, className, () => crypto.randomUUID()), describeAddClassError);
      },
      addFile: () => {
        apply(addNewFileUseCase(get().codebase, () => crypto.randomUUID()), () => '');
      },
      ...renameActions(apply, get),
      ...deleteActions(apply, set, get),
      ...moveActions(apply, get),
      ...historyActions(set, get),
      ...changeSessionActions(set, get),
      // 「最初に戻す」も1手として記録し、取り消しで戻せるようにする
      resetStage: () => {
        // 実装中に戻すと、部品置き場ごと消えてしまう
        if (get().changeSession !== null) return;
        set({ ...commit(get(), get().stage.codebase), selectedMethodId: null, message: null });
      },
      selectStage: (stageId) => {
        const next = selectStageState(get().stages, stageId);
        if (next !== null) set(next);
      },
      progress: loadProgress(),
      recordProgress: (stageId, score) => {
        const next = updateProgress(get().progress, stageId, score);
        if (next === get().progress) return;
        saveProgress(next);
        set({ progress: next });
      },
    };
  });
}

/** 既定値はリファクタリング用のストア。Providerがない所(リファクタリング画面)ではこれを使う。 */
export const GameStoreContext: Context<GameStore> = createContext(createGameStore(stages));

export function useGameStoreApi(): GameStore {
  return useContext(GameStoreContext);
}

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(useGameStoreApi(), selector);
}
