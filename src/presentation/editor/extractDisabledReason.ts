import type { Method } from '../../domain/codebase/Codebase';
import { isContiguous } from '../../domain/codebase/extractMethod';

/** 抽出ボタンを押せない理由(押せるなら null)。existingNames は抽出元と同じクラスの全メソッド名(抽出元自身を含む)。 */
export function extractDisabledReason(method: Method, selected: ReadonlySet<string>, newName: string, existingNames: readonly string[]): string | null {
  if (selected.size === 0) return '処理を1つ以上選ぶと押せます';
  if (!isContiguous(method, [...selected])) return '間の処理も選ぶか、選ぶ処理を連続させてください(離れた処理をまとめると実行順が変わります)';
  const name = newName.trim();
  if (name === '') return 'メソッド名を入れると押せます';
  if (existingNames.includes(name)) return `同じクラスに「${name}」というメソッドがあります。別の名前にしてください`;
  return null;
}
