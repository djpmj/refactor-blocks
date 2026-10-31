import type { Score } from '../../domain/scoring/score';

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
  { target: '.app__body', text: 'メソッドをクリックすると中身が右に出ます。直す必要があるメソッドの右のチェックボックスで「直した」印を付け、左の「リリースする」を押そう。結果を読んだら「組み替えを始める」へ。', advance: { kind: 'manual-fix-released' } },
  { target: '[data-testid="method-printMonthlyReport"]', text: '長すぎるメソッド printMonthlyReport() をクリックしてみよう。', advance: { kind: 'select-method', methodName: 'printMonthlyReport' } },
  { target: '[data-tour="extract-area"]', text: '処理がまとまりごとに並んでいます。左の英字と名前は責務(その処理が受け持つ仕事)の印で、同じ英字は同じ仕事です。A の処理を全部選んで「選んだ処理をメソッドとして抽出」を押そう。', advance: { kind: 'extract' } },
  { target: '.score-badge', text: '抽出の結果、点数とクリア条件がどう変わったか確かめよう。', advance: { kind: 'next' } },
];

export type ModeIntroKind = 'quiz' | 'blank';

export const MODE_INTRO_STEPS: Readonly<Record<ModeIntroKind, readonly TourStep[]>> = {
  quiz: [
    { target: '.quiz__question', text: '設計くらべでは、同じ機能を持つ2つの設計A・Bを見比べます。まず「依頼」(これから入れる変更)と行数の上限を読もう。', advance: { kind: 'next' } },
    { target: '.quiz__designs', text: '左右の図が設計Aと設計Bです。依頼を入れるとき、触るクラスが少なく、行数の上限も超えにくいのはどちらかを比べよう。', advance: { kind: 'next' } },
    { target: '.quiz__actions', text: '楽だと思う方のボタンを押すと、正解と、それぞれの設計に依頼を入れた結果(点数・触るクラス数)が出ます。', advance: { kind: 'next' } },
  ],
  // 隠れたリファクタリング画面の同じ要素を拾わないよう、白紙設計の画面の中に絞る
  blank: [
    { target: '[data-testid="blank-view"] .stage-panel__heading', text: '白紙設計では、要求文を読んで、クラスの分け方を一から組みます。まず要求文と目標を読もう。', advance: { kind: 'next' } },
    { target: '[data-testid="blank-view"] .app__canvas', text: '部品置き場にメソッドの部品が並んでいます。部品をキャンバスの空いている所へドラッグすると新しいクラスができ、クラスへ落とすとそのクラスに入ります。クラス名は自動で付きます。', advance: { kind: 'next' } },
    { target: '[data-testid="blank-view"] [data-testid="blank-review"]', text: '部品を全部置き終えると「答え合わせ」が押せます。自分の設計と模範解答の点数、変更依頼を入れたときの違いが出ます。', advance: { kind: 'next' } },
  ],
};

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

export type TourScore = Pick<Score, 'total' | 'deducted'>;
export type TourResultKind = 'cleared' | 'improved' | 'worsened' | 'unchanged';
export type TourResult = { readonly kind: TourResultKind; readonly totalBefore: number; readonly totalAfter: number };

// total は0点で下げ止まるので、増減は deducted で比べる
export function tourResultOf(before: TourScore, after: TourScore): TourResult {
  const base = { totalBefore: before.total, totalAfter: after.total };
  if (after.deducted === 0) return { kind: 'cleared', ...base };
  if (after.deducted < before.deducted) return { kind: 'improved', ...base };
  if (after.deducted > before.deducted) return { kind: 'worsened', ...base };
  return { kind: 'unchanged', ...base };
}

// ponytail: 0点で下げ止まると「0 → 0 点に上がりました」になる、0点のステージにツアーを足すときに直す
export function tourResultText(result: TourResult): string {
  const { totalBefore, totalAfter } = result;
  switch (result.kind) {
    case 'cleared':
      return `クリア条件をすべて満たしました(${totalAfter} 点)。同じ英字(同じ仕事)の処理を1つのメソッドにまとめると、長いメソッドが短くなり、仕事も混ざりません。`;
    case 'improved':
      return `点数が ${totalBefore} → ${totalAfter} 点に上がりました。まだ満たしていないクリア条件があります。課題のクリア条件を確かめて、続けてみよう。`;
    case 'worsened':
      return `点数が ${totalBefore} → ${totalAfter} 点に下がりました。「減点の内訳」で何が増えたかを確かめ、「元に戻す」で戻して選び直そう。`;
    case 'unchanged':
      return `点数は ${totalAfter} 点のまま変わっていません。同じ英字の処理をまとめて抜き出すと、点数が上がります。`;
  }
}
