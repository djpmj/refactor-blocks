import type { LearningRecord } from '../../application/LearningRecordUseCases';
import { loadStoryEnabled, saveStoryEnabled } from '../story/storyPreference';
import { loadTourSeen, saveTourSeen } from '../tour/tourPreference';
import { loadDrafts, saveDrafts } from './draftStorage';
import { loadLastStageId, saveLastStageId } from './lastStageStorage';
import { loadProgress, saveProgress } from './progressStorage';

/** 5つのキーをまとめて読む。既存の load 関数を呼ぶだけ(壊れた値は各 load が空・既定値にする)。 */
export function loadLearningRecord(): LearningRecord {
  return {
    progress: loadProgress(),
    drafts: loadDrafts(),
    lastStageId: loadLastStageId() ?? null,
    storyEnabled: loadStoryEnabled(),
    tourSeen: loadTourSeen(),
  };
}

/**
 * 5つのキーをまとめて書く。1つでも書けなかったら false。
 * いちばん大きく容量超過で失敗しやすい下書きを最初に書き、失敗したら残りを書かずに止める(setItem は失敗しても元の値を残す)。
 */
export function saveLearningRecord(record: LearningRecord): boolean {
  return (
    saveDrafts(record.drafts) &&
    saveProgress(record.progress) &&
    // loadLastStageId は空文字を「保存なし」として扱うので、null は空文字で書く(削除用の関数を足さない)
    saveLastStageId(record.lastStageId ?? '') &&
    saveStoryEnabled(record.storyEnabled) &&
    (!record.tourSeen || saveTourSeen())
  );
}
