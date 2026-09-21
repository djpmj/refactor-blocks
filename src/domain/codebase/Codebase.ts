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

/** 指定したクラスだけを置き換えた新しいCodebaseを返す(元のCodebaseは変更しない)。 */
export function mapClasses(codebase: Codebase, transform: (codeClass: CodeClass) => CodeClass): Codebase {
  return {
    files: codebase.files.map((file) => ({ ...file, classes: file.classes.map(transform) })),
  };
}
