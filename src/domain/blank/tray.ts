import { allClasses, type Codebase, type Method } from '../codebase/Codebase';

/** 部品置き場のファイルのID。白紙設計の問題データも、答え合わせもこのIDで判定する。 */
export const TRAY_FILE_ID = 'file-blank-tray';
const TRAY_CLASS_ID = 'class-blank-tray';

/** 全部品を1つのクラスに入れた、部品置き場だけのコードベースを作る。 */
export function trayCodebase(parts: readonly Method[]): Codebase {
  return { files: [{ id: TRAY_FILE_ID, path: '部品置き場', classes: [{ id: TRAY_CLASS_ID, name: '部品置き場', methods: parts }] }] };
}

/** 部品置き場のファイルを取り除いたコードベースを返す。採点の前に使う。 */
export function withoutTray(codebase: Codebase): Codebase {
  return { files: codebase.files.filter((file) => file.id !== TRAY_FILE_ID) };
}

/**
 * まだ配置されていない部品の名前を、initial での並び順で返す。
 * 部品 = initial の全メソッド。部品のFragmentが1つも withoutTray(current) に見つからなければ未配置とする
 * (部品置き場に残っている・クラスごと削除した、のどちらも未配置になる)。
 */
export function findUnplacedParts(initial: Codebase, current: Codebase): string[] {
  const parts = allClasses(initial).flatMap((codeClass) => codeClass.methods);
  const placedFragmentIds = new Set(
    allClasses(withoutTray(current))
      .flatMap((codeClass) => codeClass.methods)
      .flatMap((method) => method.fragments.map((fragment) => fragment.id)),
  );
  return parts.filter((part) => !part.fragments.some((fragment) => placedFragmentIds.has(fragment.id))).map((part) => part.name);
}
