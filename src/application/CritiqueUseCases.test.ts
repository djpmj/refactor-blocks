import { describe, expect, it } from 'vitest';
import { sampleCodebase } from '../domain/codebase/testFixtures';
import { scoreCodebase } from '../domain/scoring/score';
import { CritiqueRequestError, describeCritiqueError, requestCritiqueUseCase } from './CritiqueUseCases';

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
      'AI講評のリクエストの形が合いませんでした(不具合です)。ゲームを最新にして、もう一度お試しください',
    );
  });
});
