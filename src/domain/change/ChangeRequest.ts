/** 実務の「〇〇に対応して」という要望。1つの責務(Fragment の responsibility)に対する変更として表す。 */
export type ChangeRequest = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** 変更が必要な責務。 */
  readonly responsibility: string;
  /** 変更箇所(その責務を持つメソッド)1つあたりに増える行数。 */
  readonly linesPerSite: number;
};

/** 変更依頼の責務を持つメソッドが1つもない。 */
export type ChangeError = 'no-sites';
