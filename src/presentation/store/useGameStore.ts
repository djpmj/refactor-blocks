import { createContext, useContext, type Context } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { evaluateImplementationUseCase, isChangeChallengeCleared, type ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { describeCritiqueError, requestCritiqueUseCase } from '../../application/CritiqueUseCases';
import { withoutTray } from '../../domain/blank/tray';
import { withChangePart } from '../../domain/change/changePart';
import { checkManualFix, isManualFixSolved } from '../../domain/change/checkManualFix';
import { painRequestsOf } from '../../domain/change/changePain';
import { stageStep, type StageStep } from '../../domain/change/stageStep';
import { allClasses, findClassOfMethod, findField, findMethod, type Codebase, type Visibility } from '../../domain/codebase/Codebase';
import { autoNameClasses } from '../../domain/codebase/autoNameClasses';
import { emptyHistory, recordChange, redoHistory, undoHistory, type History, type Travel } from '../../domain/codebase/history';
import { scoreCodebase, type Score, type ScoreRule } from '../../domain/scoring/score';
import { describeOperationResult, type OperationResult } from '../stage/describeOperationResult';
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
  previewExtractMethod,
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
import { markAssist, recordClear, resetAttempt, type Assists, type AssistLevel } from '../../domain/progress/assists';
import { addMilestone, type Milestones, type StageMilestone } from '../../domain/progress/milestones';
import { updateMoveBest, type MoveBests } from '../../domain/progress/moveBests';
import { isStageCleared } from '../../domain/progress/roadmap';
import { updateProgress } from '../../domain/progress/updateProgress';
import { loadAssists, saveAssists } from '../../infrastructure/progress/assistStorage';
import { loadDrafts, saveDrafts } from '../../infrastructure/progress/draftStorage';
import { loadLastStageId, saveLastStageId } from '../../infrastructure/progress/lastStageStorage';
import { loadMoveBests, saveMoveBests } from '../../infrastructure/progress/moveBestStorage';
import { loadMilestones, loadProgress, saveMilestones, saveProgress } from '../../infrastructure/progress/progressStorage';
import { loadStoryEnabled, saveStoryEnabled } from '../../infrastructure/story/storyPreference';
import { loadTourSeen, saveTourSeen } from '../../infrastructure/tour/tourPreference';
import { nextTourStep, TOUR_STEPS, TOUR_STAGE_ID, tourResultOf, type TourEvent, type TourResult, type TourScore } from '../tour/tourSteps';
import { describeInlinedBeforeDelete } from '../canvas/describeInlinedBeforeDelete';
import type { DeleteResult } from '../../domain/codebase/deleteClass';

/** 変更依頼に挑戦中の状態。依頼ごとに部品を足したコードで実装し、依頼を1件ずつ片付ける。 */
export type ChangeSession = {
  /** 今の依頼の番号(0始まり)。 */
  readonly index: number;
  /** 何をするメソッドか確かめるために、カーソルを合わせた(フォーカスした)メソッドのID。 */
  readonly inspected: string | null;
  /** 実装を終えた今の依頼の結果。値があるときはその結果を見ている途中(置き直すか次へ進むまでは outcomes に足さない)、null のときは部品を置いている途中。 */
  readonly reviewing: ChangeOutcome | null;
  readonly outcomes: readonly ChangeOutcome[];
  /** 挑戦前のコード。挑戦を終えたらここへ戻す(依頼の実装は積み重ねるが、挑戦後には持ち越さない)。 */
  readonly base: Codebase;
  /** 今の依頼を始める前のコード。base に、前の依頼までの実装(部品置き場は除く)を積み重ねたもの。次の依頼はここへ部品置き場を足して始める。 */
  readonly carried: Codebase;
  /** carried の解答例版。前の依頼を、プレイヤーの置き方ではなく解答例の置き方で積み重ねたもの。解答例はここから求める。 */
  readonly sampleCarried: Codebase;
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

/** 変更依頼を「手で直す」シミュレーション。fixedIds は「直した」印、viewedMethodId は最後にクリックしたメソッド。 */
type ManualFix = { readonly fixedIds: readonly string[]; readonly released: boolean; readonly viewedMethodId: string | null; readonly step: StageStep };
type OpeningFix = { readonly missed: number; readonly extra: number; readonly sites: number; readonly fixedIds: readonly string[] };

const NEW_MANUAL_FIX: ManualFix = { fixedIds: [], released: false, viewedMethodId: null, step: 'refactor' };

type GameState = {
  stages: readonly Stage[];
  stage: Stage;
  layoutResetCount: number;
  codebase: Codebase;
  celebration: { readonly seq: number; readonly scoreBefore: number; readonly scoreAfter: number; readonly deductedBefore: number; readonly deductedAfter: number; readonly resolved: ViolationTarget } | null;
  clearScreen: { readonly stageId: string } | null;
  clearShownStages: readonly string[];
  dismissClearScreen: () => void;
  /** 直前のプレイヤーの操作で増えた・消えた減点。8秒(NOTICE_VISIBLE_MS)で消える。 */
  operationResult: OperationResult | null;
  dismissOperationResult: () => void;
  ghost: GhostMove | null;
  playGhost: (move: GhostMove) => void;
  clearGhost: () => void;
  history: History;
  selectedMethodId: string | null;
  selectedFieldId: string | null;
  extractDraft: ExtractMethodInput | null;
  extractOverheadExplained: boolean;
  setExtractDraft: (draft: ExtractMethodInput | null) => void;
  focusedRule: ScoreRule | null;
  hintTarget: ViolationTarget | null;
  hintTargetKey: string | null;
  previewRule: ScoreRule | null;
  hoverPreviewRule: ScoreRule | null;
  focusPreviewRule: ScoreRule | null;
  message: string | null;
  notice: string | null;
  dismissMessage: () => void;
  changeSession: ChangeSession | null;
  manualFix: ManualFix | null;
  openingFixes: Readonly<Partial<Record<string, OpeningFix | null>>>;
  openingFixEnabled: boolean;
  closingFixSolved: boolean;
  impactReviewOpen: boolean;
  openImpactReview: () => void;
  closeImpactReview: () => void;
  startManualFix: () => void;
  toggleFixed: (methodId: string) => void;
  viewManualFixMethod: (methodId: string) => void;
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
  /** 結果を見ている依頼を、その依頼を始めた時点のコードからやり直す。 */
  retryChangeRequest: () => void;
  /** 結果を確定して次の依頼(最後なら全体の結果)へ進む。 */
  advanceChangeRequest: () => void;
  endChangeRequests: () => void;
  resetStage: () => void;
  selectStage: (stageId: string) => void;
  /** 前回の下書きから再開したか。次にコードが変わったら false に戻す。 */
  restoredDraft: boolean;
  /** 下書きのあるステージID。ステージ一覧の「挑戦中」表示に使う(コードそのものは持たない)。 */
  draftStageIds: readonly string[];
  progress: Progress;
  recordProgress: (stageId: string, score: number) => void;
  /** ステージごとの、100点に向けて使った助け(次の一手・動きで見る・答え)の記録。一覧の「もう一度自力で」の印に使う。保存される。 */
  assists: Assists;
  /** 今のステージで助けを使ったことを記録する。 */
  recordAssist: (level: AssistLevel) => void;
  /** ステージごとの、100点に届いた最少の手数。progress とは別のキーに保存する。 */
  moveBests: MoveBests;
  recordMoveBest: (stageId: string, moves: number) => void;
  /** 100点のあとに終えた段階(理解度チェック・変更依頼)。一覧の「クリア」の判定に使う。保存される。 */
  milestones: Milestones;
  recordMilestone: (stageId: string, milestone: StageMilestone) => void;
  /** ストーリー(章の導入・結び)を出すか。保存される閲覧者の好み。 */
  storyEnabled: boolean;
  setStoryEnabled: (enabled: boolean) => void;
  tourStep: number | null;
  tourMethodCountAtStepStart: number;
  /** 今の手順に入ったときの点数。最後の手順で抽出の結果を作る「前」になる。 */
  tourScoreAtStepStart: TourScore;
  /** 最後の手順に入るときに作る、抽出の結果。 */
  tourResult: TourResult | null;
  startTour: (repeat?: boolean) => void;
  advanceTour: (event: TourEvent) => void;
  endTour: () => void;
};

function methodCount(codebase: Codebase): number {
  return codebase.files.reduce((count, file) => count + file.classes.reduce((classCount, codeClass) => classCount + codeClass.methods.length, 0), 0);
}

function tourActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'tourStep' | 'tourMethodCountAtStepStart' | 'tourScoreAtStepStart' | 'tourResult' | 'startTour' | 'advanceTour' | 'endTour'> {
  return {
    tourStep: null,
    tourMethodCountAtStepStart: 0,
    tourScoreAtStepStart: { total: 100, deducted: 0 },
    tourResult: null,
    startTour: (repeat = false) => {
      const state = get();
      if (state.stage.id !== TOUR_STAGE_ID || state.changeSession !== null || (!repeat && loadTourSeen())) return;
      set({ tourStep: 0, tourMethodCountAtStepStart: methodCount(state.codebase), tourScoreAtStepStart: scoreCodebase(state.codebase, state.stage), tourResult: null });
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
        set({ tourStep: null, tourResult: null });
      } else if (next !== state.tourStep) {
        const score = scoreCodebase(state.codebase, state.stage);
        // 手順4に入る前提(まだメソッドを選んでいない)を揃える
        const resetSelection = TOUR_STEPS[next].advance.kind === 'select-method' ? { selectedMethodId: null, extractDraft: null } : {};
        set({
          tourStep: next,
          tourMethodCountAtStepStart: methodCount(state.codebase),
          tourScoreAtStepStart: score,
          tourResult: next === TOUR_STEPS.length - 1 ? tourResultOf(state.tourScoreAtStepStart, score) : null,
          ...resetSelection,
        });
      }
    },
    endTour: () => {
      if (get().tourStep === null) return;
      saveTourSeen();
      set({ tourStep: null, tourResult: null });
    },
  };
}

function methodSelectionActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'selectMethod' | 'selectField'> {
  return {
    selectMethod: (methodId) => {
      set({ selectedMethodId: methodId, selectedFieldId: null, extractDraft: null, message: null, notice: null });
      const method = methodId === null ? undefined : findMethod(get().codebase, methodId);
      if (method !== undefined && get().tourStep !== null) get().advanceTour({ kind: 'method-selected', methodName: method.name });
    },
    selectField: (fieldId) => set({ selectedFieldId: fieldId, selectedMethodId: null, extractDraft: null, message: null, notice: null }),
  };
}

/** コードベースが変わったときだけ、変更前のものを履歴に積んで差し替える。何も変わらない操作は1手に数えない。 */
function celebrationFor(state: GameState, codebase: Codebase, before: Score, after: Score): GameState['celebration'] | undefined {
  const scoreBefore = before.total;
  const scoreAfter = after.total;
  const resolved = resolvedTargets(state.codebase, codebase, state.stage);
  const hasResolved = resolved.fileIds.length + resolved.classIds.length + resolved.methodIds.length > 0;
  const floorProgress = scoreBefore === 0 && scoreAfter === 0 && after.deducted < before.deducted;
  if (scoreAfter <= scoreBefore && !floorProgress && !hasResolved) return undefined;
  return { seq: (state.celebration?.seq ?? 0) + 1, scoreBefore, scoreAfter, deductedBefore: before.deducted, deductedAfter: after.deducted, resolved };
}

/** コードが変わったら、そのコードに対する案内だった光り(ヒント・「どこが問題?」)を消す。 */
const HIGHLIGHT_RESET: Partial<GameState> = { focusedRule: null, hintTarget: null, hintTargetKey: null };

function clearScreenAfterCommit(state: GameState, celebration: GameState['celebration'] | undefined): Partial<GameState> {
  const showClear = celebration != null && celebration.scoreBefore < 100 && celebration.scoreAfter === 100
    && state.changeSession === null && state.manualFix === null && state.tourStep === null
    && !state.clearShownStages.includes(state.stage.id);
  return showClear ? { clearScreen: { stageId: state.stage.id }, clearShownStages: [...state.clearShownStages, state.stage.id] } : {};
}

/** プレイヤーの操作の前後を採点して、演出と操作の結果を作る。1回の操作で採点は前後1回ずつ。 */
function scoredOperation(state: GameState, codebase: Codebase, celebrate: boolean): Partial<GameState> {
  if (!celebrate || state.changeSession !== null) return { operationResult: null };
  const before = scoreCodebase(state.codebase, state.stage);
  const after = scoreCodebase(codebase, state.stage);
  const celebration = celebrationFor(state, codebase, before, after);
  return { operationResult: describeOperationResult(before, after), ...(celebration === undefined ? {} : { celebration }), ...clearScreenAfterCommit(state, celebration) };
}

function commit(state: GameState, codebase: Codebase, celebrate = true): Partial<GameState> {
  if (codebase === state.codebase) return {};
  const namedCodebase = autoNameClasses(codebase, state.stage.classNames);
  const fieldStillThere = state.selectedFieldId !== null && findField(namedCodebase, state.selectedFieldId) !== undefined;
  return {
    codebase: namedCodebase,
    ...scoredOperation(state, namedCodebase, celebrate),
    extractDraft: null,
    ghost: null,
    ...HIGHLIGHT_RESET,
    history: recordChange(state.history, state.codebase),
    selectedFieldId: fieldStillThere ? state.selectedFieldId : null,
  };
}

function publicizedMoveNotice(after: Codebase, changes: readonly { readonly methodId: string; readonly visibility: 'public' | 'protected' }[]): string | null {
  const changed = changes.flatMap(({ methodId, visibility }) => {
    const method = findMethod(after, methodId);
    const owner = method === undefined ? undefined : findClassOfMethod(after, methodId);
    return method === undefined || owner === undefined ? [] : [{ method, owner, visibility }];
  });
  if (changed.length === 0) return null;
  if (changed.length > 1) {
    const names = changed.map(({ method }) => `${method.name}()`).join('・');
    const visibility = changed.every((item) => item.visibility === changed[0].visibility) ? changed[0].visibility : '可視性';
    return `外のクラスから呼ばれるようになったので、${names} を ${visibility} にしました`;
  }
  const { method, owner, visibility } = changed[0];
  const caller = allClasses(after).find((codeClass) => codeClass.id !== owner.id && codeClass.methods.some((candidate) => candidate.fragments.some((fragment) => (fragment.uses ?? []).includes(method.id))));
  return caller === undefined ? null : `${method.name}() は ${owner.name} の外(${caller.name})から呼ばれるようになったので、${visibility} にしました`;
}

/** 操作の結果を状態の更新にする。成功したらコードベースを差し替え、失敗したら理由を出す。 */
function applyResult<E>(state: GameState, result: Result<Codebase, E>, describe: (error: E) => string): Partial<GameState> {
  const blocked = blockDuringOpeningFix(state);
  if (blocked !== null) return blocked;
  return result.ok ? { ...commit(state, result.value), message: null, notice: null } : { message: describe(result.error), notice: null };
}

/** 取り消し・やり直しの結果を状態にする。選択中のメソッドがなくなっていたら選択を外す。 */
function travelTo(state: GameState, travel: Travel | undefined): Partial<GameState> {
  if (travel === undefined) return {};
  const { codebase, history } = travel;
  const stillThere = state.selectedMethodId !== null && findMethod(codebase, state.selectedMethodId) !== undefined;
  const fieldStillThere = state.selectedFieldId !== null && findField(codebase, state.selectedFieldId) !== undefined;
  return { codebase, history, celebration: null, operationResult: null, ghost: null, ...HIGHLIGHT_RESET, selectedMethodId: stillThere ? state.selectedMethodId : null, selectedFieldId: fieldStillThere ? state.selectedFieldId : null, extractDraft: null, message: null, notice: null };
}

const UNPLACED_MESSAGE = '部品がまだ部品置き場にあります。置き場所へドラッグしてください';
const OPENING_FIX_MESSAGE = 'まず「もし、この変更が来たら?」で、この変更を手で入れてみてください';

function currentStep(state: GameState) {
  const openingDone = Object.hasOwn(state.openingFixes, state.stage.id);
  return stageStep({
    score: scoreCodebase(state.codebase, state.stage).total,
    hasModifyRequest: painRequestsOf(state.stage).modify !== undefined,
    openingDone,
    closingSolved: state.closingFixSolved,
  });
}

function blockDuringOpeningFix(state: GameState): Partial<GameState> | null {
  return state.openingFixEnabled && currentStep(state) === 'opening-fix' ? { message: OPENING_FIX_MESSAGE, notice: null } : null;
}

const CHANGE_REQUEST_LOCK_MESSAGE = '変更依頼に進む前に、手直しと組み替えを完了してください';

const CHANGE_STEP_RESET: Partial<GameState> = { ...HIGHLIGHT_RESET, history: emptyHistory(), selectedMethodId: null, selectedFieldId: null, extractDraft: null, message: null, notice: null };

/** 今の依頼の実装を評価して、その依頼の結果を見る段階にする。次へ進むまで index も outcomes も動かさない。 */
function finishImplementation(state: GameState): Partial<GameState> {
  const session = state.changeSession;
  const request = session === null ? undefined : state.stage.changeRequests[session.index];
  if (session === null || request === undefined || session.reviewing !== null) return {};
  const result = evaluateImplementationUseCase(state.stage, {
    design: session.base,
    base: session.carried,
    sampleBase: session.sampleCarried,
    implemented: state.codebase,
  }, request);
  if (!result.ok) return { message: result.error === 'unplaced-part' ? UNPLACED_MESSAGE : 'この依頼で変更が必要な場所が見つかりません', notice: null };
  return { changeSession: { ...session, inspected: null, reviewing: result.value }, selectedMethodId: null, selectedFieldId: null, extractDraft: null, message: null, notice: null };
}

/** 結果を見ている依頼を、その依頼を始めた時点のコード(carried + 部品置き場)に戻す。 */
function retryChangeRequest(state: GameState): Partial<GameState> {
  const session = state.changeSession;
  const request = session === null ? undefined : state.stage.changeRequests[session.index];
  if (session === null || request === undefined || session.reviewing === null) return {};
  return { changeSession: { ...session, inspected: null, reviewing: null }, codebase: withChangePart(session.carried, request), ...CHANGE_STEP_RESET };
}

/** 見ていた結果を確定して次の依頼(部品を足した、実装を積み重ねたコード)へ進む。全件終えたら積み重ねたコードのまま全体の結果を出す。 */
function advanceChangeRequest(state: GameState): Partial<GameState> {
  const session = state.changeSession;
  if (session === null || session.reviewing === null) return {};
  const next = state.stage.changeRequests.at(session.index + 1);
  const carried = withoutTray(state.codebase);
  return {
    changeSession: { ...session, index: session.index + 1, inspected: null, reviewing: null, outcomes: [...session.outcomes, session.reviewing], carried, sampleCarried: session.reviewing.sample?.codebase ?? session.sampleCarried },
    codebase: next === undefined ? carried : withChangePart(carried, next),
    ...CHANGE_STEP_RESET,
  };
}

/** 最後の変更依頼を確定し、どの依頼も解答例と同じ点以上なら「変更依頼」の段階を記録する。 */
function recordChangeMilestone(state: GameState): void {
  const { changeSession, stage } = state;
  if (changeSession === null || changeSession.index !== stage.changeRequests.length) return;
  if (isChangeChallengeCleared(changeSession.outcomes, stage.changeRequests.length)) state.recordMilestone(stage.id, 'change-request');
}

function endChangeRequests(state: GameState): Partial<GameState> {
  const session = state.changeSession;
  if (session === null) return {};
  return {
    focusedRule: null, hintTarget: null, hintTargetKey: null, previewRule: null,
    hoverPreviewRule: null, focusPreviewRule: null, ghost: null,
    changeSession: null, codebase: session.base, history: session.baseHistory,
    selectedMethodId: null, selectedFieldId: null, extractDraft: null,
    message: null, notice: null,
    lastChangeReport: session.outcomes.length > 0
      ? { outcomes: session.outcomes, codebase: session.carried }
      : state.lastChangeReport,
  };
}

function historyActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'undo' | 'redo'> {
  return {
    undo: () => {
      const state = get();
      if ((state.changeSession?.reviewing ?? null) !== null) return;
      set(blockDuringOpeningFix(state) ?? travelTo(state, undoHistory(state.history, state.codebase)));
    },
    redo: () => {
      const state = get();
      if ((state.changeSession?.reviewing ?? null) !== null) return;
      set(blockDuringOpeningFix(state) ?? travelTo(state, redoHistory(state.history, state.codebase)));
    },
  };
}

function messageActions(set: (partial: Partial<GameState>) => void): Pick<GameState, 'dismissMessage' | 'dismissOperationResult'> {
  return {
    dismissOperationResult: () => {
      set({ operationResult: null });
    },
    dismissMessage: () => {
      set({ message: null, notice: null });
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
      // ponytail: 最初に戻すのあとの元に戻すで attempt は戻らない。抜け道として問題になったら、履歴の各コードに attempt を持たせる
      const assists = resetAttempt(get().assists, get().stage.id);
      if (assists !== get().assists) saveAssists(assists);
      set({ assists, ...commit(get(), get().stage.codebase, false), layoutResetCount: get().layoutResetCount + 1, celebration: null, operationResult: null, ghost: null, manualFix: null, closingFixSolved: false, impactReviewOpen: false, extractDraft: null, focusedRule: null, hintTarget: null, hintTargetKey: null, previewRule: null, hoverPreviewRule: null, focusPreviewRule: null, selectedMethodId: null, selectedFieldId: null, message: null, notice: null });
    },
  };
}

function changeSessionActions(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'startChangeRequests' | 'inspectMethod' | 'finishImplementation' | 'retryChangeRequest' | 'advanceChangeRequest' | 'endChangeRequests'> {
  return {
    startChangeRequests: () => {
      const state = get();
      const { codebase, history, stage } = state;
      const step = currentStep(state);
      if (state.openingFixEnabled && step !== 'change-request') {
        set({ message: step === 'opening-fix' ? OPENING_FIX_MESSAGE : CHANGE_REQUEST_LOCK_MESSAGE, notice: null });
        return;
      }
      const [first] = stage.changeRequests;
      set({
        focusedRule: null,
        hintTarget: null,
        hintTargetKey: null,
        previewRule: null,
        hoverPreviewRule: null,
        focusPreviewRule: null,
        ghost: null,
        operationResult: null,
        manualFix: null,
        changeSession: { index: 0, inspected: null, reviewing: null, outcomes: [], base: codebase, carried: codebase, sampleCarried: codebase, baseHistory: history },
        codebase: withChangePart(codebase, first),
        history: emptyHistory(),
        selectedMethodId: null,
        selectedFieldId: null,
        extractDraft: null,
        message: null,
        notice: null,
      });
    },
    inspectMethod: (methodId) => {
      const { changeSession } = get();
      if (changeSession !== null) set({ changeSession: { ...changeSession, inspected: methodId } });
    },
    finishImplementation: () => {
      set({ ...finishImplementation(get()), ghost: null });
    },
    retryChangeRequest: () => {
      set({ ...retryChangeRequest(get()), ghost: null });
    },
    advanceChangeRequest: () => {
      set({ ...advanceChangeRequest(get()), ghost: null });
      recordChangeMilestone(get());
    },
    endChangeRequests: () => {
      set(endChangeRequests(get()));
    },
  };
}

/** 手で直すシミュレーション。変更依頼の挑戦中は始められない。 */
function manualFixActions(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'startManualFix' | 'toggleFixed' | 'viewManualFixMethod' | 'releaseManualFix' | 'restartManualFix' | 'endManualFix' | 'openImpactReview' | 'closeImpactReview'> {
  return {
    startManualFix: () => {
      const state = get();
      if (state.changeSession !== null) return;
      set({ manualFix: { ...NEW_MANUAL_FIX, step: currentStep(state) }, extractDraft: null });
      if (state.tourStep !== null && TOUR_STEPS[state.tourStep]?.advance.kind === 'manual-fix-started') get().advanceTour({ kind: 'manual-fix-started' });
    },
    toggleFixed: (methodId) => {
      const { manualFix } = get();
      if (manualFix === null || manualFix.released) return;
      const fixedIds = manualFix.fixedIds.includes(methodId)
        ? manualFix.fixedIds.filter((id) => id !== methodId)
        : [...manualFix.fixedIds, methodId];
      set({ manualFix: { ...manualFix, fixedIds, viewedMethodId: methodId } });
    },
    viewManualFixMethod: (methodId) => {
      const { manualFix } = get();
      if (manualFix === null) return;
      set({ manualFix: { ...manualFix, viewedMethodId: methodId } });
    },
    releaseManualFix: () => {
      const state = get();
      const { manualFix, stage, codebase } = state;
      if (manualFix === null) return;
      const request = painRequestsOf(stage).modify;
      if (request === undefined) return;
      const result = checkManualFix(codebase, request, manualFix.fixedIds);
      const step = currentStep(state);
      if (step === 'opening-fix') {
        set({
          manualFix: { ...manualFix, released: true },
          openingFixes: { ...state.openingFixes, [stage.id]: { missed: result.missed.length, extra: result.extra.length, sites: result.sites, fixedIds: manualFix.fixedIds } },
        });
      } else if (step === 'closing-fix') {
        const solved = isManualFixSolved(result);
        set({ manualFix: { ...manualFix, released: true }, closingFixSolved: state.closingFixSolved || solved });
      } else {
        set({ manualFix: { ...manualFix, released: true } });
      }
    },
    restartManualFix: () => {
      const manualFix = get().manualFix;
      if (manualFix !== null) set({ manualFix: { ...NEW_MANUAL_FIX, step: manualFix.step }, extractDraft: null });
    },
    endManualFix: () => {
      const state = get();
      const advancingManualFixTour = state.manualFix?.released === true
        && state.tourStep !== null
        && TOUR_STEPS[state.tourStep]?.advance.kind === 'manual-fix-released';
      set({ manualFix: null });
      if (advancingManualFixTour) get().advanceTour({ kind: 'manual-fix-released' });
    },
    openImpactReview: () => set({ impactReviewOpen: true }),
    closeImpactReview: () => set({ impactReviewOpen: false }),
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
    operationResult: null,
    restoredDraft: draft !== undefined,
    ...(draft !== undefined && painRequestsOf(stage).modify !== undefined ? { openingFixes: { [stage.id]: null } } : {}),
    closingFixSolved: false,
    impactReviewOpen: false,
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
    notice: null,
    changeSession: null,
    manualFix: null,
    lastChangeReport: null,
    critique: EMPTY_CRITIQUE,
  };
}

type Apply = <E>(result: Result<Codebase, E>, describe: (error: E) => string) => boolean;

function createApply(set: (partial: Partial<GameState>) => void, get: () => GameState): Apply {
  return <E>(result: Result<Codebase, E>, describe: (error: E) => string): boolean => {
    const state = get();
    const blocked = blockDuringOpeningFix(state);
    if (blocked !== null) {
      set(blocked);
      return false;
    }
    set(applyResult(state, result, describe));
    return result.ok;
  };
}

function extractActions(
  apply: Apply,
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'extractMethod' | 'extractDraft' | 'setExtractDraft' | 'extractOverheadExplained'> {
  return {
    extractMethod: (input) => {
      const state = get();
      const preview = previewExtractMethod(state.codebase, input);
      const succeeded = apply(extractMethodUseCase(state.codebase, input, () => crypto.randomUUID()), describeExtractError);
      if (succeeded && preview !== undefined && !state.extractOverheadExplained && preview.fileLinesAfter > preview.fileLinesBefore) {
        set({ extractOverheadExplained: true, notice: '抽出すると、新しいメソッドの宣言と呼び出しの分だけ合計の行数は少し増えます。1つのメソッドが短くなり、読む範囲が絞れることが大事です' });
      }
      return succeeded;
    },
    extractDraft: null,
    extractOverheadExplained: false,
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
      return apply(addInterfaceUseCase(get().codebase, classId, interfaceName), (error) => describeAddInterfaceError(error, interfaceName));
    },
    removeInterface: (classId, interfaceName) => {
      return apply(removeInterfaceUseCase(get().codebase, classId, interfaceName), describeRemoveInterfaceError);
    },
  };
}

/** ドラッグ&ドロップによる移動系の操作と、メソッドの可視性を変える操作。 */
function moveMethodAction(set: (partial: Partial<GameState>) => void, get: () => GameState): (methodId: string, targetClassId: string) => void {
  return (methodId, targetClassId) => {
    const state = get();
    const blocked = blockDuringOpeningFix(state);
    if (blocked !== null) {
      set(blocked);
      return;
    }
    const enforced = state.stage.visibilityEnforced === true;
    const result = moveMethodUseCase(state.codebase, methodId, targetClassId, { visibilityEnforced: enforced });
    const notice = result.ok ? publicizedMoveNotice(result.value.codebase, result.value.changed) : null;
    set({ ...applyResult(state, result.ok ? { ok: true, value: result.value.codebase } : result, describeMoveError), ...(result.ok ? { notice } : {}) });
  };
}

function moveMethodToNewClassInFileAction(set: (partial: Partial<GameState>) => void, get: () => GameState, newId: () => string): (methodId: string, fileId: string) => void {
  return (methodId, fileId) => {
    const state = get();
    const blocked = blockDuringOpeningFix(state);
    if (blocked !== null) {
      set(blocked);
      return;
    }
    const result = moveMethodToNewClassInFileUseCase(state.codebase, methodId, fileId, { generateId: newId, visibilityEnforced: state.stage.visibilityEnforced === true });
    const notice = result.ok ? publicizedMoveNotice(result.value.codebase, result.value.changed) : null;
    set({ ...applyResult(state, result.ok ? { ok: true, value: result.value.codebase } : result, describeMoveOutError), ...(result.ok ? { notice } : {}) });
  };
}

function moveActions(
  apply: Apply,
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): Pick<GameState, 'moveMethod' | 'moveField' | 'changeVisibility' | 'moveClass' | 'moveClassToNewFile' | 'moveMethodToNewClass' | 'moveMethodToNewClassInFile'> {
  const newId = () => crypto.randomUUID();
  return {
    moveMethod: moveMethodAction(set, get),
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
      const blocked = blockDuringOpeningFix(get());
      if (blocked !== null) {
        set(blocked);
        return null;
      }
      const result = moveClassToNewFileUseCase(get().codebase, classId, newId);
      if (!result.ok) {
        apply(result, describeMoveOutError);
        return null;
      }
      set(applyResult(get(), { ok: true, value: result.value.codebase }, describeMoveOutError));
      return result.value.fileId;
    },
    moveMethodToNewClass: (methodId) => {
      const blocked = blockDuringOpeningFix(get());
      if (blocked !== null) {
        set(blocked);
        return null;
      }
      const state = get();
      const result = moveMethodToNewClassUseCase(state.codebase, methodId, { generateId: newId, visibilityEnforced: state.stage.visibilityEnforced === true });
      if (!result.ok) {
        apply(result, describeMoveOutError);
        return null;
      }
      const notice = publicizedMoveNotice(result.value.codebase, result.value.changed);
      const codebase = autoNameClasses(result.value.codebase, state.stage.classNames);
      set({ ...applyResult(state, { ok: true, value: codebase }, describeMoveOutError), notice });
      return result.value.fileId;
    },
    moveMethodToNewClassInFile: moveMethodToNewClassInFileAction(set, get, newId),
  };
}

/** クラス・ファイル・空実装メソッドを取り除く操作。 */
function deleteActions(apply: Apply, set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'deleteClass' | 'deleteFile' | 'deleteMethod'> {
  const remove = <E>(result: Result<DeleteResult, E>, describe: (error: E) => string): boolean => {
    const blocked = blockDuringOpeningFix(get());
    if (blocked !== null) {
      set(blocked);
      return false;
    }
    if (!result.ok) {
      set({ message: describe(result.error), notice: null });
      return false;
    }
    set({ ...commit(get(), result.value.codebase), message: null, notice: describeInlinedBeforeDelete(result.value.inlined) });
    return true;
  };
  return {
    deleteClass: (classId) => {
      return remove(deleteClassUseCase(get().codebase, classId), describeDeleteClassError);
    },
    deleteFile: (fileId) => {
      return remove(deleteFileUseCase(get().codebase, fileId), describeDeleteFileError);
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
      const blocked = blockDuringOpeningFix(get());
      if (blocked !== null) { set(blocked); return false; }
      const input: MergeMethodsInput = { methodAId, methodBId, newMethodName };
      const result = mergeMethodsUseCase(get().codebase, input, () => crypto.randomUUID());
      set(
        result.ok
          ? { ...commit(get(), result.value.codebase), selectedMethodId: result.value.newMethodId, message: null, notice: null }
          : { message: describeMergeError(result.error), notice: null },
      );
      return result.ok;
    },
    inlineMethod: (methodId) => {
      const blocked = blockDuringOpeningFix(get());
      if (blocked !== null) { set(blocked); return; }
      const result = inlineMethodUseCase(get().codebase, methodId);
      set(
        result.ok
          ? { ...commit(get(), result.value.codebase), selectedMethodId: result.value.callerId, message: null, notice: null }
          : { message: describeInlineError(result.error), notice: null },
      );
    },
  };
}

/** ステージごとの自己ベストの読み込みと記録、ストーリーのオン/オフ(どちらも閲覧者ごとに保存される)。 */
function progressActions(set: (partial: Partial<GameState>) => void, get: () => GameState): Pick<GameState, 'progress' | 'recordProgress' | 'assists' | 'recordAssist' | 'moveBests' | 'recordMoveBest' | 'milestones' | 'recordMilestone' | 'storyEnabled' | 'setStoryEnabled'> {
  return {
    storyEnabled: loadStoryEnabled(),
    setStoryEnabled: (enabled) => {
      saveStoryEnabled(enabled);
      set({ storyEnabled: enabled });
    },
    progress: loadProgress(),
    recordProgress: (stageId, score) => {
      const stage = get().stages.find((candidate) => candidate.id === stageId);
      if (stage === undefined) return;
      if (score >= 100) {
        const assists = recordClear(get().assists, stageId, isStageCleared(stageId, get().progress));
        if (assists !== get().assists) {
          saveAssists(assists);
          set({ assists });
        }
      }
      const next = updateProgress(get().progress, stageId, score, scoreCodebase(stage.codebase, stage).total);
      if (next === get().progress) return;
      saveProgress(next);
      set({ progress: next });
    },
    assists: loadAssists(),
    recordAssist: (level) => {
      const next = markAssist(get().assists, get().stage.id, level);
      if (next === get().assists) return;
      saveAssists(next);
      set({ assists: next });
    },
    moveBests: loadMoveBests(),
    recordMoveBest: (stageId, moves) => {
      const next = updateMoveBest(get().moveBests, stageId, moves);
      if (next === get().moveBests) return;
      saveMoveBests(next);
      set({ moveBests: next });
    },
    milestones: loadMilestones(),
    recordMilestone: (stageId, milestone) => {
      const next = addMilestone(get().milestones, stageId, milestone);
      if (next === get().milestones) return;
      saveMilestones(next);
      set({ milestones: next });
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

/** お知らせ(notice)が表示されたままになる時間。 */
export const NOTICE_VISIBLE_MS = 8000;

/**
 * 役目を終えたトーストを消す。
 * 失敗の理由(message)は、前の状態と比べて状況(コード・選択・手直し・変更依頼)が変わったときに消す。
 * その set で出た message(prev と違う)は、出した操作自身では消さない。
 * お知らせ(notice)と操作の結果(operationResult)は、置き換わるたびに数え直して NOTICE_VISIBLE_MS 後に消す。
 */
function clearStaleToasts(store: GameStore): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resultTimer: ReturnType<typeof setTimeout> | undefined;
  store.subscribe((state, prev) => {
    const situationChanged = state.codebase !== prev.codebase
      || state.selectedMethodId !== prev.selectedMethodId
      || state.selectedFieldId !== prev.selectedFieldId
      || (state.manualFix === null) !== (prev.manualFix === null)
      || (state.changeSession === null) !== (prev.changeSession === null);
    if (state.message !== null && state.message === prev.message && situationChanged) store.setState({ message: null });
    if (state.operationResult !== prev.operationResult) {
      clearTimeout(resultTimer);
      if (state.operationResult !== null) resultTimer = setTimeout(() => { store.setState({ operationResult: null }); }, NOTICE_VISIBLE_MS);
    }
    if (state.notice === prev.notice) return;
    clearTimeout(timer);
    if (state.notice !== null) timer = setTimeout(() => { store.setState({ notice: null }); }, NOTICE_VISIBLE_MS);
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

function basicClassActions(apply: Apply, get: () => GameState): Pick<GameState, 'addClass' | 'addFile'> {
  return {
    addClass: (fileId, className) => apply(addClassUseCase(get().codebase, fileId, className, () => crypto.randomUUID()), describeAddClassError),
    addFile: () => { apply(addNewFileUseCase(get().codebase, () => crypto.randomUUID()), () => ''); },
  };
}

function initialManualFixState(stage: Stage, restored: Codebase | undefined): Pick<GameState, 'openingFixes' | 'closingFixSolved'> {
  return {
    openingFixes: restored !== undefined && painRequestsOf(stage).modify !== undefined ? { [stage.id]: null } : {},
    closingFixSolved: false,
  };
}

/** 最初に開くステージ。保存されたIDのステージがあればそれ、なければ先頭。保存を使わないとき(saveDraftsOn が false)は常に先頭。 */
function initialStage(allStages: readonly Stage[], saveDraftsOn: boolean): Stage {
  const lastStageId = saveDraftsOn ? loadLastStageId() : undefined;
  return allStages.find((candidate) => candidate.id === lastStageId) ?? allStages[0];
}

/**
 * 最初のステージから始まるストアを作る。selectStage もこの stages から探す。
 * saveDraftsOn が true のときだけ、編集中のコードを localStorage の下書きに保存・復元し、
 * 最後に開いたステージを最初のステージにする(保存がない・stages に無いときは先頭)。
 */
export function createGameStore(allStages: readonly Stage[], saveDraftsOn = true, openingFixEnabled = true): GameStore {
  const firstStage = initialStage(allStages, saveDraftsOn);
  const holder = { drafts: saveDraftsOn ? loadDrafts() : {} };
  const restored = restoreFirstDraft(holder, firstStage);
  const store = createStore<GameState>((set, get) => {
    const apply = createApply(set, get);
    return {
      stages: allStages,
      stage: firstStage, layoutResetCount: 0,
      codebase: restored ?? firstStage.codebase,
      celebration: null, operationResult: null, clearScreen: null, clearShownStages: [], dismissClearScreen: () => set({ clearScreen: null }),
      restoredDraft: restored !== undefined,
      ...initialManualFixState(firstStage, restored),
      openingFixEnabled,
      impactReviewOpen: false,
      draftStageIds: Object.keys(holder.drafts),
      history: emptyHistory(),
      selectedMethodId: null,
      selectedFieldId: null,
      focusedRule: null,
      hintTarget: null,
      hintTargetKey: null,
      ...EMPTY_RULE_PREVIEW,
      message: null, notice: null, ...messageActions(set), ...ghostActions(set),
      changeSession: null,
      manualFix: null, ...manualFixActions(set, get),
      lastChangeReport: null,
      critique: EMPTY_CRITIQUE,
      ...critiqueActions(set, get),
      ...methodSelectionActions(set, get),
      ...focusActions(set, get),
      ...extractActions(apply, set, get),
      ...replaceMethodActions(set, get),
      ...basicClassActions(apply, get),
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
          if (saveDraftsOn) saveLastStageId(stageId);
          const existingOpeningFixes = get().openingFixes;
          set({ ...next, openingFixes: existingOpeningFixes, layoutResetCount: get().layoutResetCount + 1, ghost: null, clearScreen: null });
          if (next.openingFixes !== undefined) {
            set({ openingFixes: { ...existingOpeningFixes, ...next.openingFixes, [stageId]: existingOpeningFixes[stageId] ?? next.openingFixes[stageId] } });
          }
        }
      },
      ...progressActions(set, get),
      ...tourActions(set, get),
    };
  });
  if (saveDraftsOn) autosaveDrafts(store, holder);
  clearStaleToasts(store);
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
