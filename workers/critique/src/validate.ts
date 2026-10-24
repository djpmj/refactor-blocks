export type CritiqueRequestBody = {
  readonly goal: string;
  readonly score: {
    readonly total: number;
    readonly deductions: readonly { readonly rule: string; readonly count: number; readonly points: number }[];
  };
  readonly files: readonly {
    readonly lines: number;
    readonly deductionPoints: number;
    readonly classes: readonly {
      readonly name: string;
      readonly lines: number;
      readonly methods: readonly { readonly name: string; readonly visibility: string; readonly lines: number }[];
    }[];
  }[];
};

/** リクエストの文字数の上限。想定より大きい・壊れた入力をここで弾く。 */
export const MAX_BODY_LENGTH = 20_000;
export const CRITIQUE_CONTRACT_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMethodSummary(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && typeof value.visibility === 'string' && typeof value.lines === 'number';
}

function isClassSummary(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && typeof value.lines === 'number' && Array.isArray(value.methods) && value.methods.every(isMethodSummary);
}

function isFileSummary(value: unknown): boolean {
  return isRecord(value) && typeof value.lines === 'number' && typeof value.deductionPoints === 'number' && Array.isArray(value.classes) && value.classes.every(isClassSummary);
}

/** 信頼境界: ブラウザから届いたJSONが講評に使える形か確認する。 */
export function isCritiqueRequestBody(value: unknown): value is CritiqueRequestBody {
  if (!isRecord(value) || typeof value.goal !== 'string') return false;
  const { score, files } = value;
  if (!isRecord(score) || typeof score.total !== 'number' || !Array.isArray(score.deductions)) return false;
  return Array.isArray(files) && files.every(isFileSummary);
}
