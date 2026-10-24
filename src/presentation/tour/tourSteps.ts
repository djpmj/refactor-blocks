export type TourAdvance =
  | { readonly kind: 'next' }
  | { readonly kind: 'manual-fix-started' }
  | { readonly kind: 'manual-fix-released' }
  | { readonly kind: 'select-method'; readonly methodName: string }
  | { readonly kind: 'extract' };

export type TourStep = {
  readonly target: string;
  readonly text: string;
  readonly advance: TourAdvance;
};

export const TOUR_STAGE_ID = 'tutorial-extract-method';

export const TOUR_STEPS: readonly TourStep[] = [
  { target: '#stage-sidebar', text: 'ここに課題が出ます。まず課題の内容とクリア条件を確認しよう。', advance: { kind: 'next' } },
  { target: '[data-tour="manual-fix-start"]', text: '組み替える前に、まずこのコードのまま変更を入れてみよう。「実際に直してみる」を押そう。', advance: { kind: 'manual-fix-started' } },
  { target: '.app__body', text: '直す必要があるメソッドをクリックして「直した」印を付け、左の「リリースする」を押そう。結果を読んだら「組み替えを始める」へ。', advance: { kind: 'manual-fix-released' } },
  { target: '[data-testid="method-printMonthlyReport"]', text: '長すぎるメソッド printMonthlyReport() をクリックしてみよう。', advance: { kind: 'select-method', methodName: 'printMonthlyReport' } },
  { target: '[data-tour="extract-area"]', text: '処理がまとまりごとに並んでいます。左の英字は責務の印で、同じ英字は同じ仕事です。A の処理を全部選んで「選んだ処理をメソッドとして抽出」を押そう。', advance: { kind: 'extract' } },
  { target: '.score-badge', text: '新しいメソッドができ、点数とクリア条件が変わりました。メソッドがクリア条件の行数以内になるまで続けてみよう。', advance: { kind: 'next' } },
];

export type TourEvent =
  | { readonly kind: 'next' }
  | { readonly kind: 'manual-fix-started' }
  | { readonly kind: 'manual-fix-released' }
  | { readonly kind: 'method-selected'; readonly methodName: string }
  | { readonly kind: 'method-count'; readonly count: number; readonly countAtStepStart: number };

function matchesAdvance(advance: TourAdvance, event: TourEvent): boolean {
  if (event.kind === 'next') return true;
  if (advance.kind === 'manual-fix-started') return event.kind === 'manual-fix-started';
  if (advance.kind === 'manual-fix-released') return event.kind === 'manual-fix-released';
  if (advance.kind === 'select-method') return event.kind === 'method-selected' && event.methodName === advance.methodName;
  if (advance.kind === 'extract') return event.kind === 'method-count' && event.count > event.countAtStepStart;
  return false;
}

export function nextTourStep(steps: readonly TourStep[], current: number, event: TourEvent): number | null {
  const step = steps[current];
  if (!matchesAdvance(step.advance, event)) return current;
  return current + 1 >= steps.length ? null : current + 1;
}
