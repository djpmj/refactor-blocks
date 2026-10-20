import type { Visibility } from '../../domain/codebase/Codebase';

type MethodChipLabelInput = {
  readonly name: string;
  readonly visibility: Visibility;
  readonly lines: number;
  readonly lineLimit?: number;
  readonly overLimit: boolean;
  readonly mixed: boolean;
  readonly fixed: boolean;
};

export function methodChipLabel(input: MethodChipLabelInput): string {
  const parts = [`${input.name}()`, input.visibility, `${input.lines}行`];
  if (input.overLimit && input.lineLimit !== undefined) parts.push(`行数の上限 ${input.lineLimit}行を超えています`);
  if (input.mixed) parts.push('別々の仕事が混ざっています');
  if (input.fixed) parts.push('「直した」印あり');
  return parts.join('、');
}
