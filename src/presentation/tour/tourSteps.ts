export type TourAdvance =
  | { readonly kind: 'next' }
  | { readonly kind: 'select-method'; readonly methodName: string }
  | { readonly kind: 'click-inside' }
  | { readonly kind: 'extract' };

export type TourStep = {
  readonly target: string;
  readonly text: string;
  readonly advance: TourAdvance;
};

export const TOUR_STAGE_ID = 'tutorial-extract-method';

export const TOUR_STEPS: readonly TourStep[] = [
  { target: '#stage-sidebar', text: 'ここに課題が出ます。まず課題の内容とクリア条件を確認しよう。', advance: { kind: 'next' } },
  { target: '[data-testid="method-printMonthlyReport"]', text: '長すぎるメソッド printMonthlyReport() をクリックしてみよう。', advance: { kind: 'select-method', methodName: 'printMonthlyReport' } },
  { target: '[data-tour="fragment-list"]', text: '処理がまとまりごとに並んでいます。一緒に切り出したいまとまりを選ぼう。', advance: { kind: 'click-inside' } },
  { target: '[data-tour="extract-button"]', text: '「選んだ処理をメソッドとして抽出」を押そう。', advance: { kind: 'extract' } },
  { target: '.score-badge', text: '新しいメソッドができ、点数とクリア条件が変わりました。メソッドが50行以内になるまで続けてみよう。', advance: { kind: 'next' } },
];

export type TourEvent =
  | { readonly kind: 'next' }
  | { readonly kind: 'method-selected'; readonly methodName: string }
  | { readonly kind: 'clicked-inside' }
  | { readonly kind: 'method-count'; readonly count: number; readonly countAtStepStart: number };

export function nextTourStep(steps: readonly TourStep[], current: number, event: TourEvent): number | null {
  const step = steps[current];
  const advance = step.advance;
  const canAdvance = event.kind === 'next'
    || (advance.kind === 'select-method' && event.kind === 'method-selected' && event.methodName === advance.methodName)
    || (advance.kind === 'click-inside' && event.kind === 'clicked-inside')
    || (advance.kind === 'extract' && event.kind === 'method-count' && event.count > event.countAtStepStart);
  if (!canAdvance) return current;
  return current + 1 >= steps.length ? null : current + 1;
}
