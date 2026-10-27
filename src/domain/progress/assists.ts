/** 100点に向けて使った助けの段階。弱い順に 'step'(次の一手)< 'ghost'(動きで見る)< 'answer'(解答例の図・解答の再生)。 */
export type AssistLevel = 'step' | 'ghost' | 'answer';

export type StageAssists = {
  /** 今のコード(最後の「最初に戻す」以降)で使った一番強い助け。使っていなければ持たない。 */
  readonly attempt?: AssistLevel;
  /** 100点にしたときの助け(一番弱かったクリア)。自力・記録なしなら持たない。 */
  readonly clearedWith?: AssistLevel;
};

/** ステージIDごとの助けの記録。 */
export type Assists = Readonly<Partial<Record<string, StageAssists>>>;

const STRENGTH: Readonly<Record<AssistLevel, number>> = { step: 1, ghost: 2, answer: 3 };

/** そのステージの記録を差し替える。中身が空なら記録ごと消す。 */
function withStage(assists: Assists, stageId: string, entry: StageAssists): Assists {
  const rest = Object.fromEntries(Object.entries(assists).filter(([id]) => id !== stageId));
  return entry.attempt === undefined && entry.clearedWith === undefined ? rest : { ...rest, [stageId]: entry };
}

/** 助けを使ったことを記録する。今より強い段階のときだけ attempt が上がる(変わらなければ同じ参照を返す)。 */
export function markAssist(assists: Assists, stageId: string, level: AssistLevel): Assists {
  const entry = assists[stageId] ?? {};
  if (entry.attempt !== undefined && STRENGTH[entry.attempt] >= STRENGTH[level]) return assists;
  return { ...assists, [stageId]: { ...entry, attempt: level } };
}

/** 「最初に戻す」: attempt を消す。clearedWith は消さない。 */
export function resetAttempt(assists: Assists, stageId: string): Assists {
  const entry = assists[stageId];
  if (entry?.attempt === undefined) return assists;
  return withStage(assists, stageId, { clearedWith: entry.clearedWith });
}

/**
 * 100点にしたことを記録する。印は「一番良いクリア」で決める。
 * 初めての100点は attempt が clearedWith になる(無ければ自力)。100点済みなら、ある clearedWith を弱める・消すだけで、強めない・新しく付けない。
 */
export function recordClear(assists: Assists, stageId: string, alreadyCleared: boolean): Assists {
  const entry = assists[stageId] ?? {};
  const { attempt, clearedWith } = entry;
  if (!alreadyCleared) return attempt === undefined || attempt === clearedWith ? assists : withStage(assists, stageId, { attempt, clearedWith: attempt });
  if (clearedWith === undefined) return assists;
  if (attempt === undefined) return withStage(assists, stageId, { attempt });
  if (STRENGTH[attempt] >= STRENGTH[clearedWith]) return assists;
  return withStage(assists, stageId, { attempt, clearedWith: attempt });
}

/** 「もう一度自力で」の印。clearedWith を返す。 */
export function retryMark(assists: Assists, stageId: string): AssistLevel | undefined {
  return assists[stageId]?.clearedWith;
}

function isAssistLevel(value: unknown): value is AssistLevel {
  return value === 'step' || value === 'ghost' || value === 'answer';
}

/** localStorage から読んだ値が StageAssists の形か。信頼境界の入力検証。 */
export function isStageAssists(value: unknown): value is StageAssists {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const attempt: unknown = Reflect.get(value, 'attempt');
  const clearedWith: unknown = Reflect.get(value, 'clearedWith');
  return (attempt === undefined || isAssistLevel(attempt)) && (clearedWith === undefined || isAssistLevel(clearedWith));
}
