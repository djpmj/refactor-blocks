import type { Method } from '../../domain/codebase/Codebase';
import { isContiguous } from '../../domain/codebase/extractMethod';

type ExtractBlock = { readonly reason: string; readonly nameInvalid: boolean };

/** 抽出ボタンを押せない理由を1つだけ決める(優先順: 選択なし > 非連続 > 名前が空 > 重複)。表示する理由と aria-invalid はここから導く。 */
function blockOf(method: Method, selected: ReadonlySet<string>, newName: string, existingNames: readonly string[]): ExtractBlock | null {
  if (selected.size === 0) return { reason: '処理を1つ以上選ぶと押せます', nameInvalid: false };
  if (!isContiguous(method, [...selected])) {
    return { reason: '間の処理も選ぶか、選ぶ処理を連続させてください(離れた処理をまとめると実行順が変わります)', nameInvalid: false };
  }
  const name = newName.trim();
  if (name === '') return { reason: 'メソッド名を入れると押せます', nameInvalid: false };
  if (existingNames.includes(name)) return { reason: `同じクラスに「${name}」というメソッドがあります。別の名前にしてください`, nameInvalid: true };
  return null;
}

/** 抽出ボタンを押せない理由(押せるなら null)。existingNames は抽出元と同じクラスの全メソッド名(抽出元自身を含む)。 */
export function extractDisabledReason(method: Method, selected: ReadonlySet<string>, newName: string, existingNames: readonly string[]): string | null {
  return blockOf(method, selected, newName, existingNames)?.reason ?? null;
}

/** 表示している理由が名前の重複のときだけ true(理由が出ていないのに入力欄を invalid にしない)。 */
export function extractNameInvalid(method: Method, selected: ReadonlySet<string>, newName: string, existingNames: readonly string[]): boolean {
  return blockOf(method, selected, newName, existingNames)?.nameInvalid ?? false;
}
