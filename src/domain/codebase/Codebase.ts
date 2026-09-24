export type Visibility = 'public' | 'private' | 'protected';

/**
 * メソッドの中の、切り出し可能な処理のまとまり。
 * responsibility は採点用の隠しタグで、プレイヤーには表示しない(例: 'validation' / 'tax' / 'io')。
 * uses はこの処理が呼び出すメソッドのID。クラス間の依存の元になる。
 * suggestedName はこの処理だけを抽出したときのメソッド名の候補(例: 'calculateTax')。
 */
export type Fragment = {
  readonly id: string;
  readonly label: string;
  readonly lines: number;
  readonly responsibility: string;
  readonly uses?: readonly string[];
  readonly suggestedName?: string;
  /**
   * この処理が、別クラスの処理と文字通り同じ実装(コピペによる重複)であることを示す隠しタグ。
   * 同じ値を持つ処理同士だけが Merge Methods で統合できる。responsibility と同じくプレイヤーには表示しない。
   * 省略時はどの処理とも統合できない(既存ステージはこのタグを使わないため影響しない)。
   */
  readonly duplicateGroup?: string;
};

export type Method = {
  readonly id: string;
  readonly name: string;
  readonly visibility: Visibility;
  readonly fragments: readonly Fragment[];
};

export type CodeClass = {
  readonly id: string;
  readonly name: string;
  readonly methods: readonly Method[];
  /** 継承元(extends)のクラスID。継承なしなら省略する。 */
  readonly superclassId?: string;
  /** 実装しているインターフェース(implements)のクラスID。宣言順。省略は [] と同じ。 */
  readonly interfaceIds?: readonly string[];
};

export type CodeFile = {
  readonly id: string;
  readonly path: string;
  readonly classes: readonly CodeClass[];
};

export type Codebase = {
  readonly files: readonly CodeFile[];
};

export function allClasses(codebase: Codebase): CodeClass[] {
  return codebase.files.flatMap((file) => file.classes);
}

export function findMethod(codebase: Codebase, methodId: string): Method | undefined {
  return allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .find((method) => method.id === methodId);
}

export function findClassOfMethod(codebase: Codebase, methodId: string): CodeClass | undefined {
  return allClasses(codebase).find((codeClass) => codeClass.methods.some((method) => method.id === methodId));
}

export function findClass(codebase: Codebase, classId: string): CodeClass | undefined {
  return allClasses(codebase).find((codeClass) => codeClass.id === classId);
}

export function findFileOfClass(codebase: Codebase, classId: string): CodeFile | undefined {
  return codebase.files.find((file) => file.classes.some((codeClass) => codeClass.id === classId));
}

/** 親クラスを引く。継承なし、または親が削除済みで見つからないときは undefined。 */
export function findSuperclass(codebase: Codebase, classId: string): CodeClass | undefined {
  const superclassId = findClass(codebase, classId)?.superclassId;
  return superclassId === undefined ? undefined : findClass(codebase, superclassId);
}

/** 親(継承元 → 実装先の宣言順)のID。存在しないIDもそのまま返す(呼び出し側で findClass して捨てる)。 */
export function parentIds(codeClass: CodeClass): string[] {
  return [...(codeClass.superclassId === undefined ? [] : [codeClass.superclassId]), ...(codeClass.interfaceIds ?? [])];
}

/** 実装しているインターフェース。削除済みで見つからないIDは飛ばす。 */
export function findInterfaces(codebase: Codebase, classId: string): CodeClass[] {
  const interfaceIds = findClass(codebase, classId)?.interfaceIds ?? [];
  return interfaceIds.map((id) => findClass(codebase, id)).filter((codeClass): codeClass is CodeClass => codeClass !== undefined);
}

/** インターフェース役 = メソッドが1つ以上あり、すべて public で中身(Fragment)がない。 */
export function isInterfaceLike(codeClass: CodeClass): boolean {
  return codeClass.methods.length > 0 && codeClass.methods.every((method) => method.visibility === 'public' && method.fragments.length === 0);
}

/** 指定したクラスだけを置き換えた新しいCodebaseを返す(元のCodebaseは変更しない)。 */
export function mapClasses(codebase: Codebase, transform: (codeClass: CodeClass) => CodeClass): Codebase {
  return {
    files: codebase.files.map((file) => ({ ...file, classes: file.classes.map(transform) })),
  };
}
