import { describe, expect, it } from 'vitest';
import { allClasses, findClass, findSuperclass } from '../../domain/codebase/Codebase';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import { advancedStages } from './advancedStages';

/**
 * 採点(line-limit/coupling/cycle/responsibility)は継承の有無を見ないので、
 * 「模範解答で100点になる」だけでは継承が実際に使われているかを確認できない。
 * この上級ステージの狙いそのもの(継承元の設定)を別途確認する。
 */
describe('advanced-notifier-hierarchy', () => {
  const [stage] = advancedStages;

  it('模範解答では、EmailNotifier・SmsNotifierの継承元がどちらもNotifierBaseになる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const emailSuperclass = findSuperclass(solved, 'class-email-notifier');
    const smsSuperclass = findSuperclass(solved, 'class-sms-notifier');

    // Assert
    expect(emailSuperclass?.name).toBe('NotifierBase');
    expect(smsSuperclass?.name).toBe('NotifierBase');
  });

  it('模範解答では、共通処理(通知文の組み立て・ログ記録)がNotifierBaseに集まる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const notifierBase = findClass(solved, 'class-notifier-base');
    const methodNames = notifierBase?.methods.map((method) => method.name) ?? [];

    // Assert
    expect(methodNames).toEqual(['buildEmailBody', 'logEmailNotification', 'buildSmsBody', 'logSmsNotification']);
  });

  it('初期状態では、まだ継承関係が結ばれていない', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const superclasses = allClasses(codebase).map((codeClass) => findSuperclass(codebase, codeClass.id));

    // Assert
    expect(superclasses.every((superclass) => superclass === undefined)).toBe(true);
  });
});
