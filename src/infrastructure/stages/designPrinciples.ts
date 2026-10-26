import type { DesignPrinciple } from '../../domain/stage/Stage';

export type DesignPrincipleInfo = {
  /** バッジと「関係する原則」に出す表示名。 */
  readonly label: string;
  /** 「なぜ分けるのか」カードに出す1行の説明。40文字以内。 */
  readonly summary: string;
};

export const DESIGN_PRINCIPLES: Readonly<Record<DesignPrinciple, DesignPrincipleInfo>> = {
  srp: { label: 'SRP(単一責任)', summary: '1つのクラス・メソッドが変わる理由は1つにする' },
  ocp: { label: 'OCP(開放閉鎖)', summary: '新しい種類は、既存のコードを書き換えずに足せるようにする' },
  dip: { label: 'DIP(依存性逆転)', summary: '具体的なクラスではなく、インターフェースに依存する' },
  isp: { label: 'ISP(インターフェース分離)', summary: '使わないメソッドの実装を、クラスに強制しない' },
  dry: { label: 'DRY(重複の排除)', summary: '同じ知識・処理は1か所にまとめる' },
  adp: { label: 'ADP(非循環依存)', summary: 'クラス同士の依存は一方向にし、輪にしない' },
  encapsulation: { label: 'カプセル化', summary: 'データと、それを扱う処理を同じクラスに置いて守る' },
  yagni: { label: 'YAGNI(不要な仕組みを作らない)', summary: '今要らない仕組み(中継だけの層・余分な継承)は残さない' },
};
