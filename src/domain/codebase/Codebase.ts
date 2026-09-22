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
  /** 親クラスのID。継承・実装なしなら省略する。 */
  readonly superclassId?: string;
  /** superclassId との関係の種類。省略時は 'extends' 扱い。 */
  readonly superclassKind?: 'extends' | 'implements';
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

/** 指定したクラスだけを置き換えた新しいCodebaseを返す(元のCodebaseは変更しない)。 */
export function mapClasses(codebase: Codebase, transform: (codeClass: CodeClass) => CodeClass): Codebase {
  return {
    files: codebase.files.map((file) => ({ ...file, classes: file.classes.map(transform) })),
  };
}
