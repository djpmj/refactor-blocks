import { isDraft, type Drafts } from '../domain/progress/drafts';
import { isProgress, type Progress } from '../domain/progress/Progress';
import { updateProgress } from '../domain/progress/updateProgress';
import { isReflectionNotes, type ReflectionNotes } from '../domain/progress/reflectionNotes';
import { err, ok, type Result } from '../domain/shared/Result';

/** ブラウザに保存している学習記録のすべて。ファイルに書き出す単位。 */
export type LearningRecord = {
  readonly progress: Progress;
  readonly drafts: Drafts;
  readonly reflectionNotes: ReflectionNotes;
  /** 最後に遊んだステージID。無ければ null。 */
  readonly lastStageId: string | null;
  readonly storyEnabled: boolean;
  readonly tourSeen: boolean;
};

export type ImportMode = 'merge' | 'overwrite';

export const LEARNING_RECORD_VERSION = 1;
/** 読み込むファイルの文字数の上限(localStorage の容量の目安 約5MB に合わせる)。 */
export const MAX_LEARNING_RECORD_LENGTH = 5_000_000;

const APP_NAME = 'refactor-blocks';

export function serializeLearningRecord(record: LearningRecord): string {
  return JSON.stringify({ app: APP_NAME, version: LEARNING_RECORD_VERSION, ...record }, null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDrafts(value: unknown): value is Drafts {
  return isObject(value) && Object.values(value).every(isDraft);
}

function readReflectionNotes(value: unknown): Result<ReflectionNotes, string> {
  if (value === undefined) return ok({});
  return isReflectionNotes(value) ? ok(value) : err('振り返りメモ(reflectionNotes)の形式が正しくありません');
}

function checkHeader(data: unknown): Result<Record<string, unknown>, string> {
  if (!isObject(data) || data.app !== APP_NAME) return err('Refactor Blocks の学習記録ファイルではありません');
  const { version } = data;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return err('学習記録ファイルのバージョンが読み取れません');
  if (version > LEARNING_RECORD_VERSION) {
    return err(`新しいバージョンのゲームで書き出されたファイルです(読み込めるのはバージョン${String(LEARNING_RECORD_VERSION)}まで)`);
  }
  return ok(data);
}

/** 書き出したファイルの文字列を検証して読み取る。不正なら理由(日本語)を返し、一部だけ取り込むことはしない。 */
export function parseLearningRecord(text: string): Result<LearningRecord, string> {
  if (text.length > MAX_LEARNING_RECORD_LENGTH) return err('ファイルが大きすぎます(5MBまで)');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return err('JSONとして読めないファイルです');
  }
  const header = checkHeader(data);
  if (!header.ok) return header;
  const { progress, drafts, reflectionNotes, lastStageId, storyEnabled, tourSeen } = header.value;
  if (!isProgress(progress)) return err('自己ベスト点数(progress)の形式が正しくありません');
  if (!isDrafts(drafts)) return err('途中の下書き(drafts)の形式が正しくありません');
  const notes = readReflectionNotes(reflectionNotes);
  if (!notes.ok) return notes;
  if (lastStageId !== null && typeof lastStageId !== 'string') return err('最後に遊んだステージ(lastStageId)の形式が正しくありません');
  if (typeof storyEnabled !== 'boolean' || typeof tourSeen !== 'boolean') return err('設定(storyEnabled・tourSeen)の形式が正しくありません');
  return ok({ progress, drafts, reflectionNotes: notes.value, lastStageId, storyEnabled, tourSeen });
}

function mergeProgress(current: Progress, imported: Progress): Progress {
  // 自己ベストの高いほうを残す。初期点は 0 にして、ファイルの点数をそのまま候補にする
  return Object.entries(imported).reduce<Progress>((merged, [stageId, score]) => (score === undefined ? merged : updateProgress(merged, stageId, score, -1)), current);
}

/** このブラウザの記録とファイルの記録を合成する。merge は「足す」操作でこのブラウザの下書き・好みを保ち、overwrite はファイルの内容に置き換える。ツアー済みはどちらでも戻さない。 */
export function combineLearningRecords(current: LearningRecord, imported: LearningRecord, mode: ImportMode): LearningRecord {
  const tourSeen = current.tourSeen || imported.tourSeen;
  if (mode === 'overwrite') return { ...imported, tourSeen };
  return {
    progress: mergeProgress(current.progress, imported.progress),
    drafts: { ...imported.drafts, ...current.drafts },
    reflectionNotes: { ...imported.reflectionNotes, ...current.reflectionNotes },
    lastStageId: current.lastStageId ?? imported.lastStageId,
    storyEnabled: current.storyEnabled,
    tourSeen,
  };
}
