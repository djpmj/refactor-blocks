import type { ManualFixResult } from '../../domain/change/checkManualFix';

type DescribeManualFixInput = Readonly<{
  result: ManualFixResult;
  classNames: readonly string[];
  opening: boolean;
  readLines: number;
}>;

export function describeManualFix({ result, classNames, opening, readLines }: DescribeManualFixInput): readonly string[] {
  const messages: string[] = [];
  if (result.sites >= 2 && classNames.length >= 2) {
    messages.push(`今のコードでは、この変更を入れるのに ${result.sites} か所(${classNames.length} クラス)を直す必要があります。1つのクラスにまとめれば、直し忘れが起きにくくなります`);
  } else if (result.sites >= 2 && classNames.length === 1) {
    messages.push(`直す ${result.sites} か所は、どれも ${classNames[0]} の中です`);
  }
  if (opening) {
    messages.push(result.missed.length > 0 || result.extra.length > 0
      ? 'この痛みを覚えておこう。組み替えたあと、同じ変更がどう変わるかを確かめます'
      : `この変更のために ${readLines} 行を読みました。組み替えたあと、同じ変更で読む量がどう変わるかを確かめます`);
  }
  return messages;
}
