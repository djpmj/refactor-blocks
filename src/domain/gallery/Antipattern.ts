import type { Stage } from '../stage/Stage';

/** 図鑑の1項目。コードの臭い、または設計の原則。 */
export type AntipatternEntry = {
  /** 例: 'feature-envy'。data-testid に使う */
  readonly id: string;
  /** 'smell' = コードの臭い、'principle' = 設計の原則。見出しの分け方にだけ使う */
  readonly kind: 'smell' | 'principle';
  /** 見出し。例: 'Feature Envy(他クラスのデータを触りすぎ)' */
  readonly name: string;
  /** どんな見た目のコードか(1〜2文) */
  readonly symptom: string;
  /** 放っておくと何が困るか(1〜2文) */
  readonly harm: string;
  /** どう直すか。このゲームの操作名で書く(1〜2文) */
  readonly remedy: string;
  /** 練習できるステージを引くためのタグ。`Stage.learns` の文字列と完全一致させる */
  readonly learns: readonly string[];
};

/** entry.learns のどれかを learns に持つステージを、stages の並び順で返す。 */
export function practiceStages(entry: AntipatternEntry, stages: readonly Stage[]): readonly Stage[] {
  return stages.filter((stage) => stage.learns.some((tag) => entry.learns.includes(tag)));
}
