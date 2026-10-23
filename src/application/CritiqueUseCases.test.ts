import { describe, expect, it } from 'vitest';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import { scoreCodebase } from '../domain/scoring/score';
import { CritiqueRequestError, CritiqueVersionMismatchError, describeCritiqueError, requestCritiqueUseCase } from './CritiqueUseCases';

const STAGE = {
  codebase: sampleCodebase(),
  goal: 'メソッドの責務を分ける',
  limits: { method: 100, class: 100, file: 100 },
  responsibilityLimit: 100,
  dependencyLimit: 100,
};

describe('requestCritiqueUseCase', () => {
  it('注入した通信関数が成功したら、講評文をokで返す', async () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, STAGE);
    const requestCritique = () => Promise.resolve('よくできています');

    // Act
    const result = await requestCritiqueUseCase(codebase, STAGE, score, requestCritique);

    // Assert
    expect(result).toEqual({ ok: true, value: 'よくできています' });
  });

  it('注入した通信関数が失敗したら、エラーを返す', async () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, STAGE);
    const requestCritique = () => Promise.reject(new Error('network error'));

    // Act
    const result = await requestCritiqueUseCase(codebase, STAGE, score, requestCritique);

    // Assert
    expect(result).toEqual({ ok: false, error: 'request-failed' });
  });

  it('400を表すリクエスト形式エラーなら専用のエラーを返す', async () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, STAGE);
    const requestCritique = () => Promise.reject(new CritiqueRequestError());

    // Act
    const result = await requestCritiqueUseCase(codebase, STAGE, score, requestCritique);

    // Assert
    expect(result).toEqual({ ok: false, error: 'invalid-request' });
  });

  it('契約版の食い違いなら専用のエラーを返す', async () => {
    // Arrange
    const codebase = sampleCodebase();
    const score = scoreCodebase(codebase, STAGE);
    const requestCritique = () => Promise.reject(new CritiqueVersionMismatchError());

    // Act
    const result = await requestCritiqueUseCase(codebase, STAGE, score, requestCritique);

    // Assert
    expect(result).toEqual({ ok: false, error: 'version-mismatch' });
  });
});

describe('describeCritiqueError', () => {
  it('request-failedのメッセージを返す', () => {
    // Act & Assert
    expect(describeCritiqueError('request-failed')).toBe(
      'AI講評を取得できませんでした。しばらくしてからもう一度お試しください',
    );
  });

  it('invalid-requestのメッセージを返す', () => {
    // Act & Assert
    expect(describeCritiqueError('invalid-request')).toBe(
      'AI講評のリクエストの形が合いませんでした(不具合です)。時間をおいてもう一度お試しください',
    );
    expect(describeCritiqueError('invalid-request')).not.toContain('ゲームを最新にして');
  });

  it('version-mismatchのメッセージを返す', () => {
    // Act & Assert
    expect(describeCritiqueError('version-mismatch')).toBe(
      'AI講評のサーバーが、このゲームの版にまだ対応していません。サーバーの更新をお待ちください(ゲーム側の操作は不要です)',
    );
  });
});
