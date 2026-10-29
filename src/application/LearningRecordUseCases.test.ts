import { describe, expect, it } from 'vitest';
import type { Codebase } from '../domain/codebase/Codebase';
import {
  combineLearningRecords,
  MAX_LEARNING_RECORD_LENGTH,
  parseLearningRecord,
  serializeLearningRecord,
  type LearningRecord,
} from './LearningRecordUseCases';

const codebase: Codebase = {
  files: [{ id: 'f', path: 'a.cs', classes: [{ id: 'c', name: 'C', methods: [{ id: 'm', name: 'm', visibility: 'public', fragments: [{ id: 'fr', label: 'l', lines: 3, responsibility: 'r' }] }] }] }],
};

function record(overrides: Partial<LearningRecord> = {}): LearningRecord {
  return { progress: { a: 40 }, drafts: { a: { fingerprint: 'fp', codebase } }, reflectionNotes: {}, lastStageId: 'a', storyEnabled: true, tourSeen: true, ...overrides };
}

function fileOf(overrides: Record<string, unknown>): string {
  return JSON.stringify({ app: 'refactor-blocks', version: 1, progress: {}, drafts: {}, lastStageId: null, storyEnabled: true, tourSeen: false, ...overrides });
}

function errorOf(text: string): string | undefined {
  const result = parseLearningRecord(text);
  return result.ok ? undefined : result.error;
}

describe('parseLearningRecord', () => {
  it('メモを往復し、古いファイルでは空のメモを使う', () => {
    // Arrange
    const original = record({ reflectionNotes: { a: '気づき' } });

    // Act
    const roundTrip = parseLearningRecord(serializeLearningRecord(original));
    const oldFile = parseLearningRecord(fileOf({}));

    // Assert
    expect(roundTrip).toEqual({ ok: true, value: original });
    expect(oldFile.ok && oldFile.value.reflectionNotes).toEqual({});
  });

  it('メモの形が壊れていれば断る', () => {
    // Arrange・Act・Assert
    for (const reflectionNotes of [null, [], { a: '' }, { a: 1 }, { a: 'x'.repeat(141) }]) {
      expect(errorOf(fileOf({ reflectionNotes }))).toBe('振り返りメモ(reflectionNotes)の形式が正しくありません');
    }
  });
  it('serialize の出力を往復できる', () => {
    // Arrange
    const original = record();

    // Act
    const result = parseLearningRecord(serializeLearningRecord(original));

    // Assert
    expect(result).toEqual({ ok: true, value: original });
  });

  it('空の記録・lastStageId が null でも ok', () => {
    // Arrange・Act
    const result = parseLearningRecord(fileOf({}));

    // Assert
    expect(result.ok).toBe(true);
  });

  it('未知のフィールドは無視する', () => {
    // Arrange・Act
    const result = parseLearningRecord(fileOf({ extra: 1 }));

    // Assert
    expect(result.ok && 'extra' in result.value).toBe(false);
  });

  it('大きすぎるファイルは JSON.parse の前に断る', () => {
    // Arrange・Act・Assert
    expect(errorOf('x'.repeat(MAX_LEARNING_RECORD_LENGTH + 1))).toBe('ファイルが大きすぎます(5MBまで)');
  });

  it('JSON として壊れている', () => {
    // Arrange・Act・Assert
    expect(errorOf('{')).toBe('JSONとして読めないファイルです');
  });

  it('別のアプリのファイル・オブジェクトでない値を断る', () => {
    // Arrange
    const message = 'Refactor Blocks の学習記録ファイルではありません';

    // Act・Assert
    for (const text of ['[]', 'null', '1', '{"version":1}', '{"app":"other","version":1}']) expect(errorOf(text)).toBe(message);
  });

  it('新しいバージョンのファイルを断る', () => {
    // Arrange・Act・Assert
    expect(errorOf(fileOf({ version: 2 }))).toBe('新しいバージョンのゲームで書き出されたファイルです(読み込めるのはバージョン1まで)');
  });

  it('バージョンが読み取れないファイルを断る', () => {
    // Arrange
    const message = '学習記録ファイルのバージョンが読み取れません';

    // Act・Assert
    expect(errorOf('{"app":"refactor-blocks"}')).toBe(message);
    for (const version of ['1', 0, 1.5]) expect(errorOf(fileOf({ version }))).toBe(message);
  });

  it('progress が不正なら断る', () => {
    // Arrange
    const message = '自己ベスト点数(progress)の形式が正しくありません';

    // Act・Assert
    expect(errorOf('{"app":"refactor-blocks","version":1}')).toBe(message);
    for (const progress of [[], { a: 101 }, { a: -1 }, { a: '100' }]) expect(errorOf(fileOf({ progress }))).toBe(message);
  });

  it('drafts が不正なら1件だけでもファイル全体を断る', () => {
    // Arrange
    const message = '途中の下書き(drafts)の形式が正しくありません';
    const good = { fingerprint: 'fp', codebase };

    // Act・Assert
    for (const drafts of [[], { a: { fingerprint: 1, codebase } }, { a: good, b: { fingerprint: 'fp', codebase: {} } }]) {
      expect(errorOf(fileOf({ drafts }))).toBe(message);
    }
    expect(errorOf('{"app":"refactor-blocks","version":1,"progress":{}}')).toBe(message);
  });

  it('lastStageId が無い・文字列と null 以外なら断る', () => {
    // Arrange
    const message = '最後に遊んだステージ(lastStageId)の形式が正しくありません';
    const withoutLastStage = '{"app":"refactor-blocks","version":1,"progress":{},"drafts":{},"storyEnabled":true,"tourSeen":true}';

    // Act・Assert
    expect(errorOf(withoutLastStage)).toBe(message);
    expect(errorOf(fileOf({ lastStageId: 123 }))).toBe(message);
    expect(parseLearningRecord(fileOf({ lastStageId: 'a' })).ok).toBe(true);
  });

  it('storyEnabled・tourSeen が真偽値でなければ断る', () => {
    // Arrange
    const message = '設定(storyEnabled・tourSeen)の形式が正しくありません';

    // Act・Assert
    expect(errorOf(fileOf({ storyEnabled: 'true' }))).toBe(message);
    expect(errorOf(fileOf({ tourSeen: undefined }))).toBe(message);
  });

  it('progress の __proto__ キーでプロトタイプ汚染しない', () => {
    // Arrange
    const text = '{"app":"refactor-blocks","version":1,"progress":{"__proto__":50},"drafts":{},"lastStageId":null,"storyEnabled":true,"tourSeen":true}';

    // Act
    const result = parseLearningRecord(text);

    // Assert
    expect(result.ok && Object.getPrototypeOf(result.value.progress)).toBe(Object.prototype);
  });
});

describe('serializeLearningRecord', () => {
  it('app・version と5項目を持ち、null はそのまま出る', () => {
    // Arrange・Act
    const parsed: unknown = JSON.parse(serializeLearningRecord(record({ lastStageId: null })));

    // Assert
    expect(parsed).toEqual({ app: 'refactor-blocks', version: 1, progress: { a: 40 }, drafts: { a: { fingerprint: 'fp', codebase } }, reflectionNotes: {}, lastStageId: null, storyEnabled: true, tourSeen: true });
  });
});

describe('combineLearningRecords', () => {
  it('merge はブラウザのメモを優先し、overwrite はファイルのメモに置き換える', () => {
    // Arrange
    const current = record({ reflectionNotes: { a: 'ブラウザ', x: '残す' } });
    const imported = record({ reflectionNotes: { a: 'ファイル', b: '追加' } });

    // Act・Assert
    expect(combineLearningRecords(current, imported, 'merge').reflectionNotes).toEqual({ a: 'ブラウザ', b: '追加', x: '残す' });
    expect(combineLearningRecords(current, imported, 'overwrite').reflectionNotes).toEqual(imported.reflectionNotes);
  });
  it('merge: 点数はステージごとに高いほう', () => {
    // Arrange
    const current = record({ progress: { a: 40, b: 100 } });
    const imported = record({ progress: { a: 100, b: 60, c: 20 } });

    // Act
    const merged = combineLearningRecords(current, imported, 'merge');

    // Assert
    expect(merged.progress).toEqual({ a: 100, b: 100, c: 20 });
  });

  it('merge: 下書きは同じステージならこのブラウザのもの、無いステージはファイルから足す', () => {
    // Arrange
    const mine = { fingerprint: 'mine', codebase };
    const theirs = { fingerprint: 'theirs', codebase };
    const current = record({ drafts: { a: mine } });
    const imported = record({ drafts: { a: theirs, b: theirs } });

    // Act
    const merged = combineLearningRecords(current, imported, 'merge');

    // Assert
    expect(merged.drafts).toEqual({ a: mine, b: theirs });
  });

  it('merge: lastStageId はこのブラウザ優先、無ければファイルのもの', () => {
    // Arrange・Act・Assert
    expect(combineLearningRecords(record({ lastStageId: 'x' }), record({ lastStageId: 'y' }), 'merge').lastStageId).toBe('x');
    expect(combineLearningRecords(record({ lastStageId: null }), record({ lastStageId: 'y' }), 'merge').lastStageId).toBe('y');
  });

  it('merge: storyEnabled はこのブラウザの設定を保つ', () => {
    // Arrange・Act
    const merged = combineLearningRecords(record({ storyEnabled: false }), record({ storyEnabled: true }), 'merge');

    // Assert
    expect(merged.storyEnabled).toBe(false);
  });

  it('overwrite: tourSeen 以外はファイルの値に置き換わる', () => {
    // Arrange
    const current = record({ progress: { only: 90 }, drafts: { only: { fingerprint: 'fp', codebase } }, lastStageId: 'x', storyEnabled: false });
    const imported = record({ progress: { a: 40 }, drafts: {}, lastStageId: null, storyEnabled: true });

    // Act
    const result = combineLearningRecords(current, imported, 'overwrite');

    // Assert
    expect(result).toEqual({ ...imported, tourSeen: true });
  });

  it('merge・overwrite とも tourSeen は OR', () => {
    // Arrange
    const seen = record({ tourSeen: true });
    const unseen = record({ tourSeen: false });

    // Act・Assert
    for (const mode of ['merge', 'overwrite'] as const) {
      expect(combineLearningRecords(seen, unseen, mode).tourSeen).toBe(true);
      expect(combineLearningRecords(unseen, seen, mode).tourSeen).toBe(true);
      expect(combineLearningRecords(unseen, unseen, mode).tourSeen).toBe(false);
    }
  });

  it('引数を変更しない', () => {
    // Arrange
    const current = Object.freeze(record({ progress: Object.freeze({ a: 40 }) }));
    const imported = Object.freeze(record({ progress: Object.freeze({ a: 100 }) }));

    // Act
    const act = () => [combineLearningRecords(current, imported, 'merge'), combineLearningRecords(current, imported, 'overwrite')];

    // Assert
    expect(act).not.toThrow();
    expect(current.progress).toEqual({ a: 40 });
    expect(imported.progress).toEqual({ a: 100 });
  });
});
