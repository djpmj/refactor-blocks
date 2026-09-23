/** 'modify' = 既存のルールの変更(その責務を持つ既存クラスを1つ直すのが正解)。'extend' = 機能の追加(既存クラスを直さずに足せるのが理想)。 */
export type ChangeKind = 'modify' | 'extend';

/** 実務の「〇〇に対応して」という要望。1つの責務(Fragment の responsibility)に対する変更として表す。 */
export type ChangeRequest = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** 変更が必要な責務。 */
  readonly responsibility: string;
  /** 変更箇所(その責務を持つメソッド)1つあたりに増える行数。実装で出す新規部品の行数にも使う。 */
  readonly linesPerSite: number;
  /** 省略時は 'modify'。quiz・blank の依頼は省略のまま。 */
  readonly kind?: ChangeKind;
  /** 実装で出す新規部品のメソッド名。省略時は 'addedLogic'。リファクタリングのステージでは必ず書く(stageCatalog.test.ts で確認)。 */
  readonly partName?: string;
};

/** 変更依頼の責務を持つメソッドが1つもない。 */
export type ChangeError = 'no-sites';

export function changeKindOf(request: ChangeRequest): ChangeKind {
  return request.kind ?? 'modify';
}
