import { err, ok, type Result } from '../shared/Result';
import type { ConceptCheck } from './Stage';

export type CheckJudgement = { readonly correct: boolean; readonly answer: number };

/** 選んだ選択肢の添字を採点する。範囲外の添字は不正解として扱う(例外は投げない)。 */
export function judgeCheck(check: ConceptCheck, chosen: number): CheckJudgement {
  return { correct: chosen === check.answer, answer: check.answer };
}

export type CheckDefinitionError = 'too-few-choices' | 'too-many-choices' | 'answer-out-of-range' | 'empty-text' | 'duplicate-choice';

const MIN_CHOICES = 3;
const MAX_CHOICES = 4;

/** ステージ定義の問題が書き方の決まりを満たすかを調べる。満たせば ok、満たさなければ最初に見つかった誤り。 */
export function validateCheck(check: ConceptCheck): Result<ConceptCheck, CheckDefinitionError> {
  const count = check.choices.length;
  if (count < MIN_CHOICES) return err('too-few-choices');
  if (count > MAX_CHOICES) return err('too-many-choices');
  if (!Number.isInteger(check.answer) || check.answer < 0 || check.answer >= count) return err('answer-out-of-range');
  const texts = [check.question, ...check.choices.flatMap((choice) => [choice.text, choice.explanation])];
  if (texts.some((text) => text.trim() === '')) return err('empty-text');
  if (new Set(check.choices.map((choice) => choice.text.trim())).size !== count) return err('duplicate-choice');
  return ok(check);
}
