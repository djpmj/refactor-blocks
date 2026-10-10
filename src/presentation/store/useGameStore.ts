import { createContext, useContext, type Context } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { evaluateImplementationUseCase, type ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { describeCritiqueError, requestCritiqueUseCase } from '../../application/CritiqueUseCases';
import { withoutTray } from '../../domain/blank/tray';
import { withChangePart } from '../../domain/change/changePart';
import { findField, findMethod, type Codebase, type Visibility } from '../../domain/codebase/Codebase';
import { emptyHistory, recordChange, redoHistory, undoHistory, type History, type Travel } from '../../domain/codebase/history';
import { scoreCodebase, type ScoreRule } from '../../domain/scoring/score';
import { resolvedTargets } from '../../domain/scoring/resolvedTargets';
import type { ViolationTarget } from '../../domain/scoring/violationTargets';
import type { Stage } from '../../domain/stage/Stage';
import type { GhostMove } from '../../domain/stage/ghostMove';
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
import { putDraft, takeDraft, type Drafts } from '../../domain/progress/drafts';
import { updateProgress } from '../../domain/progress/updateProgress';
import { loadDrafts, saveDrafts } from '../../infrastructure/progress/draftStorage';
import { loadProgress, saveProgress } from '../../infrastructure/progress/progressStorage';
import { loadStoryEnabled, saveStoryEnabled } from '../../infrastructure/story/storyPreference';
import { loadTourSeen, saveTourSeen } from '../../infrastructure/tour/tourPreference';
import { nextTourStep, TOUR_STEPS, TOUR_STAGE_ID, type TourEvent } from '../tour/tourSteps';

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
const EMPTY_RULE_PREVIEW = { previewRule: null, hoverPreviewRule: null, focusPreviewRule: null };

/** 変更依頼を「手で直す」シミュレーション。fixedIds は「直した」印を付けたメソッドのID。 */
type ManualFix = { readonly fixedIds: readonly string[]; readonly released: boolean };

const NEW_MANUAL_FIX: ManualFix = { fixedIds: [], released: false };

type GameState = {
  stages: readonly Stage[];
  stage: Stage;
  codebase: Codebase;
  celebration: { readonly seq: number; readonly scoreBefore: number; readonly scoreAfter: number; readonly resolved: ViolationTarget } | null;
  ghost: GhostMove | null;
  playGhost: (move: GhostMove) => void;
  clearGhost: () => void;
  history: History;
  selectedMethodId: string | null;
  selectedFieldId: string | null;
  extractDraft: ExtractMethodInput | null;
  setExtractDraft: (draft: ExtractMethodInput | null) => void;
  focusedRule: ScoreRule | null;
  hintTarget: ViolationTarget | null;
  hintTargetKey: string | null;
  previewRule: ScoreRule | null;
  hoverPreviewRule: ScoreRule | null;
  focusPreviewRule: ScoreRule | null;
  message: string | null;
  dismissMessage: () => void;
  changeSession: ChangeSession | null;
  manualFix: ManualFix | null;
  startManualFix: () => void;
  toggleFixed: (methodId: string) => void;
  releaseManualFix: () => void;
  restartManualFix: () => void;
  endManualFix: () => void;
  lastChangeReport: ChangeReport | null;
  critique: CritiqueState;
  requestCritique: () => void;
  selectMethod: (methodId: string | null) => void;
  selectField: (fieldId: string) => void;
  focusRule: (rule: ScoreRule | null) => void;
  focusHint: (target: ViolationTarget | null, hintKey?: string) => void;
  previewRuleFor: (rule: ScoreRule | null, source: 'hover' | 'focus') => void;
  moveMethod: (methodId: string, targetClassId: string) => void;
  moveField: (fieldId: string, targetClassId: string) => void;
  changeVisibility: (methodId: string, visibility: Visibility) => void;
  extractMethod: (input: ExtractMethodInput) => boolean;
  mergeMethods: (methodAId: string, methodBId: string, newMethodName: string) => boolean;
  inlineMethod: (methodId: string) => void;
  addClass: (fileId: string, className: string) => boolean;
  addFile: () => void;
  moveClass: (classId: string, targetFileId: string) => void;
  moveClassToNewFile: (classId: string) => string | null;
  moveMethodToNewClass: (methodId: string) => string | null;
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
  /** 前回の下書きから再開したか。次にコードが変わったら false に戻す。 */
  restoredDraft: boolean;
  /** 下書きのあるステージID。ステージ一覧の「挑戦中」表示に使う(コードそのものは持たない)。 */
  draftStageIds: readonly string[];
  progress: Progress;
  recordProgress: (stageId: string, score: number) => void;
  /** ストーリー(章の導入・結び)を出すか。保存される閲覧者の好み。 */
  storyEnabled: boolean;
  setStoryEnabled: (enabled: boolean) => void;
  tourStep: number | null;
  tourMethodCountAtStepStart: number;
  startTour: (repeat?: boolean) => void;
  advanceTour: (event: TourEvent) => void;
  endTour: () => void;
};

function methodCount(codebase: Codebase): number {
  return codebase.files.reduce((count, file) => count + file.classes.reduce((classCount, codeClass) => classCount + codeClass.methods.length, 0), 0);
}

function tourActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'tourStep' | 'tourMethodCountAtStepStart' | 'startTour' | 'advanceTour' | 'endTour'> {
  return {
    tourStep: null,
    tourMethodCountAtStepStart: 0,
    startTour: (repeat = false) => {
      const state = get();
      if (state.stage.id !== TOUR_STAGE_ID || state.changeSession !== null || (!repeat && loadTourSeen())) return;
      set({ tourStep: 0, tourMethodCountAtStepStart: methodCount(state.codebase) });
    },
    advanceTour: (event) => {
      const state = get();
      if (state.tourStep === null) return;
      const effectiveEvent = event.kind === 'method-count'
        ? { ...event, countAtStepStart: state.tourMethodCountAtStepStart }
        : event;
      const next = nextTourStep(TOUR_STEPS, state.tourStep, effectiveEvent);
      if (next === null) {
        saveTourSeen();
        set({ tourStep: null });
      } else if (next !== state.tourStep) {
        set({ tourStep: next, tourMethodCountAtStepStart: methodCount(state.codebase) });
      }
    },
    endTour: () => {
      if (get().tourStep === null) return;
      saveTourSeen();
      set({ tourStep: null });
    },
  };
}

function methodSelectionActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'selectMethod' | 'selectField'> {
  return {
    selectMethod: (methodId) => {
      set({ selectedMethodId: methodId, selectedFieldId: null, extractDraft: null, message: null });
      const method = methodId === null ? undefined : findMethod(get().codebase, methodId);
      if (method !== undefined && get().tourStep !== null) get().advanceTour({ kind: 'method-selected', methodName: method.name });
    },
    selectField: (fieldId) => set({ selectedFieldId: fieldId, selectedMethodId: null, extractDraft: null, message: null }),
  };
}

/** コードベースが変わったときだけ、変更前のものを履歴に積んで差し替える。何も変わらない操作は1手に数えない。 */
function celebrationFor(state: GameState, codebase: Codebase, enabled: boolean): GameState['celebration'] | undefined {
  if (!enabled || state.changeSession !== null) return undefined;
  const scoreBefore = scoreCodebase(state.codebase, state.stage).total;
  const scoreAfter = scoreCodebase(codebase, state.stage).total;
  const resolved = resolvedTargets(state.codebase, codebase, state.stage);
  const hasResolved = resolved.fileIds.length + resolved.classIds.length + resolved.methodIds.length > 0;
  if (scoreAfter <= scoreBefore && !hasResolved) return undefined;
  return { seq: (state.celebration?.seq ?? 0) + 1, scoreBefore, scoreAfter, resolved };
}

function commit(state: GameState, codebase: Codebase, celebrate = true): Partial<GameState> {
  if (codebase === state.codebase) return {};
  const fieldStillThere = state.selectedFieldId !== null && findField(codebase, state.selectedFieldId) !== undefined;
  const celebration = celebrationFor(state, codebase, celebrate);
  return {
    codebase,
    ...(celebration === undefined ? {} : { celebration }),
    extractDraft: null,
    ghost: null,
    history: recordChange(state.history, state.codebase),
    selectedFieldId: fieldStillThere ? state.selectedFieldId : null,
  };
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
  const fieldStillThere = state.selectedFieldId !== null && findField(codebase, state.selectedFieldId) !== undefined;
  return { codebase, history, celebration: null, ghost: null, selectedMethodId: stillThere ? state.selectedMethodId : null, selectedFieldId: fieldStillThere ? state.selectedFieldId : null, extractDraft: null, message: null };
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
    selectedFieldId: null,
    extractDraft: null,
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

function messageActions(set: (partial: Partial<GameState>) => void): Pick<GameState, 'dismissMessage'> {
  return {
    dismissMessage: () => {
      set({ message: null });
    },
  };
}

function ghostActions(set: (partial: Partial<GameState>) => void): Pick<GameState, 'ghost' | 'playGhost' | 'clearGhost'> {
  return { ghost: null, playGhost: (ghost) => set({ ghost }), clearGhost: () => set({ ghost: null }) };
}

function focusActions(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'focusRule' | 'focusHint' | 'previewRuleFor'> {
  return {
    focusRule: (focusedRule) => set({ focusedRule, hintTarget: null, hintTargetKey: null, previewRule: null, hoverPreviewRule: null, focusPreviewRule: null }),
    focusHint: (hintTarget, hintKey) => set({ hintTarget, hintTargetKey: hintTarget === null ? null : hintKey ?? null, focusedRule: null }),
    previewRuleFor: (previewRule, source) => {
      const hoverPreviewRule = source === 'hover' ? previewRule : get().hoverPreviewRule;
      const focusPreviewRule = source === 'focus' ? previewRule : get().focusPreviewRule;
      set({ hoverPreviewRule, focusPreviewRule, previewRule: hoverPreviewRule ?? focusPreviewRule });
    },
  };
}

function resetActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'resetStage'> {
  return {
    resetStage: () => {
      if (get().changeSession !== null) return;
      set({ ...commit(get(), get().stage.codebase, false), celebration: null, ghost: null, manualFix: null, extractDraft: null, focusedRule: null, hintTarget: null, hintTargetKey: null, previewRule: null, hoverPreviewRule: null, focusPreviewRule: null, selectedMethodId: null, selectedFieldId: null, message: null });
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
        focusedRule: null,
        hintTarget: null,
        hintTargetKey: null,
        previewRule: null,
        hoverPreviewRule: null,
        focusPreviewRule: null,
        ghost: null,
        manualFix: null,
        changeSession: { index: 0, inspected: null, outcomes: [], base: codebase, carried: codebase, baseHistory: history },
        codebase: withChangePart(codebase, first),
        history: emptyHistory(),
        selectedMethodId: null,
        selectedFieldId: null,
        extractDraft: null,
        message: null,
      });
    },
    inspectMethod: (methodId) => {
      const { changeSession } = get();
      if (changeSession !== null) set({ changeSession: { ...changeSession, inspected: methodId } });
    },
    finishImplementation: () => {
      set({ ...finishImplementation(get()), ghost: null });
    },
    endChangeRequests: () => {
      const { changeSession, lastChangeReport } = get();
      if (changeSession === null) return;
      const { outcomes, base, carried, baseHistory } = changeSession;
      set({
        focusedRule: null,
        hintTarget: null,
        hintTargetKey: null,
        previewRule: null,
        hoverPreviewRule: null,
        focusPreviewRule: null,
        ghost: null,
        changeSession: null,
        codebase: base,
        history: baseHistory,
        selectedMethodId: null,
        selectedFieldId: null,
        extractDraft: null,
        message: null,
        lastChangeReport: outcomes.length > 0 ? { outcomes, codebase: carried } : lastChangeReport,
      });
    },
  };
}

/** 手で直すシミュレーション。変更依頼の挑戦中は始められない。 */
function manualFixActions(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'startManualFix' | 'toggleFixed' | 'releaseManualFix' | 'restartManualFix' | 'endManualFix'> {
  return {
    startManualFix: () => {
      if (get().changeSession === null) set({ manualFix: NEW_MANUAL_FIX, extractDraft: null });
    },
    toggleFixed: (methodId) => {
      const { manualFix } = get();
      if (manualFix === null || manualFix.released) return;
      const fixedIds = manualFix.fixedIds.includes(methodId)
        ? manualFix.fixedIds.filter((id) => id !== methodId)
        : [...manualFix.fixedIds, methodId];
      set({ manualFix: { ...manualFix, fixedIds } });
    },
    releaseManualFix: () => {
      const { manualFix } = get();
      if (manualFix !== null) set({ manualFix: { ...manualFix, released: true } });
    },
    restartManualFix: () => {
      if (get().manualFix !== null) set({ manualFix: NEW_MANUAL_FIX, extractDraft: null });
    },
    endManualFix: () => {
      set({ manualFix: null });
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
function selectStageState(allStages: readonly Stage[], stageId: string, drafts: Drafts): Partial<GameState> | null {
  const stage = allStages.find((candidate) => candidate.id === stageId);
  if (stage === undefined) return null;
  const draft = takeDraft(drafts, stage);
  return {
    stage,
    codebase: draft ?? stage.codebase,
    celebration: null,
    restoredDraft: draft !== undefined,
    history: emptyHistory(),
    selectedMethodId: null,
    selectedFieldId: null,
    extractDraft: null,
    focusedRule: null,
    hintTarget: null,
    hintTargetKey: null,
    previewRule: null,
    hoverPreviewRule: null,
    focusPreviewRule: null,
    message: null,
    changeSession: null,
    manualFix: null,
    lastChangeReport: null,
    critique: EMPTY_CRITIQUE,
  };
}

type Apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string) => boolean;

function extractActions(
  apply: Apply,
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'extractMethod' | 'extractDraft' | 'setExtractDraft'> {
  return {
    extractMethod: (input) => apply(extractMethodUseCase(get().codebase, input, () => crypto.randomUUID()), describeExtractError),
    extractDraft: null,
    setExtractDraft: (draft) => set({ extractDraft: draft }),
  };
}

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
  set: (partial: Partial<GameState>) => void,
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
      const result = moveClassToNewFileUseCase(get().codebase, classId, newId);
      if (!result.ok) {
        apply(result, describeMoveOutError);
        return null;
      }
      set(applyResult(get(), { ok: true, value: result.value.codebase }, describeMoveOutError));
      return result.value.fileId;
    },
    moveMethodToNewClass: (methodId) => {
      const result = moveMethodToNewClassUseCase(get().codebase, methodId, newId);
      if (!result.ok) {
        apply(result, describeMoveOutError);
        return null;
      }
      set(applyResult(get(), { ok: true, value: result.value.codebase }, describeMoveOutError));
      return result.value.fileId;
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

/** ステージごとの自己ベストの読み込みと記録、ストーリーのオン/オフ(どちらも閲覧者ごとに保存される)。 */
function progressActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'progress' | 'recordProgress' | 'storyEnabled' | 'setStoryEnabled'> {
  return {
    storyEnabled: loadStoryEnabled(),
    setStoryEnabled: (enabled) => {
      saveStoryEnabled(enabled);
      set({ storyEnabled: enabled });
    },
    progress: loadProgress(),
    recordProgress: (stageId, score) => {
      const next = updateProgress(get().progress, stageId, score);
      if (next === get().progress) return;
      saveProgress(next);
      set({ progress: next });
    },
  };
}

export type GameStore = StoreApi<GameState>;

/** 採点の対象になっているコード(変更依頼の実装中は挑戦前のコード)が変わるたびに、ステージの下書きとして保存する。 */
function autosaveDrafts(store: GameStore, holder: { drafts: Drafts }): void {
  store.subscribe((state, prev) => {
    if (state.codebase === prev.codebase && state.changeSession === prev.changeSession) return;
    holder.drafts = putDraft(holder.drafts, state.stage, state.changeSession?.base ?? state.codebase);
    saveDrafts(holder.drafts);
    store.setState({ draftStageIds: Object.keys(holder.drafts) });
    // ステージを切り替えたときの復元は、お知らせを出すので戻さない
    if (state.restoredDraft && state.stage === prev.stage) store.setState({ restoredDraft: false });
  });
}

/** 最初のステージの下書きを取り出す。指紋が違う・形が壊れた下書きは捨てて(ストレージからも消して) undefined を返す。 */
function restoreFirstDraft(holder: { drafts: Drafts }, firstStage: Stage): Codebase | undefined {
  const restored = takeDraft(holder.drafts, firstStage);
  if (restored === undefined && holder.drafts[firstStage.id] !== undefined) {
    holder.drafts = putDraft(holder.drafts, firstStage, firstStage.codebase);
    saveDrafts(holder.drafts);
  }
  return restored;
}

/**
 * stages の先頭のステージから始まるストアを作る。selectStage もこの stages から探す。
 * saveDraftsOn が true のときだけ、編集中のコードを localStorage の下書きに保存・復元する。
 */
export function createGameStore(allStages: readonly Stage[], saveDraftsOn = true): GameStore {
  const [firstStage] = allStages;
  const holder = { drafts: saveDraftsOn ? loadDrafts() : {} };
  const restored = restoreFirstDraft(holder, firstStage);
  const store = createStore<GameState>((set, get) => {
    /** 操作の結果を反映し、成功したかを返す。 */
    const apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string): boolean => {
      set(applyResult(get(), result, describe));
      return result.ok;
    };
    return {
      stages: allStages,
      stage: firstStage,
      codebase: restored ?? firstStage.codebase,
      celebration: null,
      restoredDraft: restored !== undefined,
      draftStageIds: Object.keys(holder.drafts),
      history: emptyHistory(),
      selectedMethodId: null,
      selectedFieldId: null,
      focusedRule: null,
      hintTarget: null,
      hintTargetKey: null,
      ...EMPTY_RULE_PREVIEW,
      message: null,
      ...messageActions(set), ...ghostActions(set),
      changeSession: null,
      manualFix: null, ...manualFixActions(set, get),
      lastChangeReport: null,
      critique: EMPTY_CRITIQUE,
      ...critiqueActions(set, get),
      ...methodSelectionActions(set, get),
      ...focusActions(set, get),
      ...extractActions(apply, set, get),
      ...replaceMethodActions(set, get),
      addClass: (fileId, className) => {
        return apply(addClassUseCase(get().codebase, fileId, className, () => crypto.randomUUID()), describeAddClassError);
      },
      addFile: () => {
        apply(addNewFileUseCase(get().codebase, () => crypto.randomUUID()), () => '');
      },
      ...renameActions(apply, get),
      ...deleteActions(apply, set, get),
      ...moveActions(apply, set, get),
      ...historyActions(set, get),
      ...changeSessionActions(set, get),
      ...resetActions(set, get),
      selectStage: (stageId) => {
        const next = selectStageState(get().stages, stageId, holder.drafts);
        if (next !== null) {
          if (get().stage.id !== stageId) get().endTour();
          set({ ...next, ghost: null });
        }
      },
      ...progressActions(set, get),
      ...tourActions(set, get),
    };
  });
  if (saveDraftsOn) autosaveDrafts(store, holder);
  return store;
}

/** 既定値はリファクタリング用のストア。Providerがない所(リファクタリング画面)ではこれを使う。 */
export const GameStoreContext: Context<GameStore> = createContext(createGameStore(stages));

export function useGameStoreApi(): GameStore {
  return useContext(GameStoreContext);
}

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(useGameStoreApi(), selector);
}
