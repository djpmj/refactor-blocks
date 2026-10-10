export type Visibility = 'public' | 'private' | 'protected';

/** コードプレビューに対応する言語。 */
export type CodeLanguage = 'csharp';

/**
 * メソッドの中の、切り出し可能な処理のまとまり。
 * responsibility は採点用の隠しタグで、プレイヤーには表示しない(例: 'validation' / 'tax' / 'io')。
 * uses はこの処理が呼び出すメソッドのID。クラス間の依存の元になる。
 * suggestedName はこの処理だけを抽出したときのメソッド名の候補(例: 'calculateTax')。
 */
export type Fragment = {
  readonly id: string;
  readonly label: string;
  /** ソースコード表示用。csharp の行数はここから計算する。 */
  readonly code?: Partial<Record<CodeLanguage, string>>;
  /** コードを持たないFragmentの行数。csharp のコードがあれば表示・採点にはコード行数を使う。 */
  readonly lines: number;
  readonly responsibility: string;
  readonly uses?: readonly string[];
  /** call Fragment が uses の各メソッドへ渡す引数。省略時は引数なしで呼ぶ。 */
  readonly callArguments?: readonly string[];
  readonly suggestedName?: string;
  /**
   * この処理が、別クラスの処理と文字通り同じ実装(コピペによる重複)であることを示す隠しタグ。
   * 同じ値を持つ処理同士だけが Merge Methods で統合できる。responsibility と同じくプレイヤーには表示しない。
   * 省略時はどの処理とも統合できない(既存ステージはこのタグを使わないため影響しない)。
   */
  readonly duplicateGroup?: string;
  /**
   * インターフェースの都合で書かされただけの空実装(何もせず return する・「未対応」の例外を投げるだけ)であることを示す隠しタグ。
   * responsibility・duplicateGroup と同じくプレイヤーには表示しない(ラベルに「未対応: …」と書く)。省略時は通常の処理。
   */
  readonly stub?: boolean;
  /** この処理が読むフィールドのID。クラス間の依存・Feature Envy・カプセル化の採点の元になる。省略は [] と同じ。 */
  readonly reads?: readonly string[];
  /** この処理が書き換えるフィールドのID。読み書きの両方をするときもここだけに書けばよい。省略は [] と同じ。 */
  readonly writes?: readonly string[];
  /**
   * フィールドを返す・代入するだけの getter/setter の処理であることを示す隠しタグ。responsibility・stub と同じくプレイヤーには表示しない。
   * 全部の処理が accessor のメソッドを他の処理が呼ぶと、そのメソッドが読む・書くフィールドを読んだ・書いたものとして Feature Envy・カプセル化の破れを数える。省略時は通常の処理。
   */
  readonly accessor?: boolean;
};

/** クラスが持つデータ。行数は持たない(クラス・ファイルの行数は今までどおりメソッドの Fragment だけから数える)。 */
// ponytail: フィールド宣言の行数は数えない。フィールドの多いクラスの大きさを採点したくなったら lineCount に足す
export type Field = {
  readonly id: string;
  readonly name: string;
  readonly visibility: Visibility;
  /** 画面とコードのコメントに出す日本語の説明。省略可。 */
  readonly description?: string;
  /** 言語ごとの型(表示用)。省略可。無い言語ではコードに宣言を出さず「未入力」にする。 */
  readonly type?: Partial<Record<CodeLanguage, string>>;
};

export type Method = {
  readonly id: string;
  readonly name: string;
  readonly visibility: Visibility;
  readonly parameters?: readonly { readonly type: string; readonly name: string }[];
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
  /** クラスが持つフィールド。宣言順。省略は [] と同じ(既存ステージは書かない)。 */
  readonly fields?: readonly Field[];
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

/** 空実装のメソッド = 処理が1つ以上あり、すべてstub。中身のない契約メソッド(fragments: [])は空実装ではない。 */
export function isStubMethod(method: Method): boolean {
  return method.fragments.length > 0 && method.fragments.every((fragment) => fragment.stub === true);
}

/** getter/setter = 処理が1つ以上あり、すべてaccessor。isStubMethodと同じ形。 */
export function isAccessorMethod(method: Method): boolean {
  return method.fragments.length > 0 && method.fragments.every((fragment) => fragment.accessor === true);
}

/**
 * 処理が呼んでいる getter/setter(isAccessorMethod)越しに読む・書くフィールドのID。
 * 呼び先のアクセサの処理のreadsをreadsに、writesをwritesに集める。それぞれ重複なし、usesの順。存在しないメソッドIDは飛ばす。
 * ponytail: アクセサは1段だけたどる。アクセサがアクセサを呼ぶ題材を作るときに再帰にする
 */
function calledAccessorMethods(codebase: Codebase, fragment: Fragment): Method[] {
  return (fragment.uses ?? [])
    .map((methodId) => findMethod(codebase, methodId))
    .filter((method): method is Method => method !== undefined && isAccessorMethod(method));
}

export function accessorFieldAccess(codebase: Codebase, fragment: Fragment): { readonly reads: string[]; readonly writes: string[] } {
  const accessorFragments = calledAccessorMethods(codebase, fragment).flatMap((method) => method.fragments);
  return {
    reads: [...new Set(accessorFragments.flatMap((accessorFragment) => accessorFragment.reads ?? []))],
    writes: [...new Set(accessorFragments.flatMap((accessorFragment) => accessorFragment.writes ?? []))],
  };
}

/** クラス自身と、extends(superclassId)をたどった先祖のクラスID集合。輪になっていても訪問済みで止まる。 */
export function extendsChainIds(codebase: Codebase, classId: string): Set<string> {
  const ids = new Set<string>();
  let current: CodeClass | undefined = findClass(codebase, classId);
  while (current !== undefined && !ids.has(current.id)) {
    ids.add(current.id);
    current = current.superclassId === undefined ? undefined : findClass(codebase, current.superclassId);
  }
  return ids;
}

/** 指定したクラスだけを置き換えた新しいCodebaseを返す(元のCodebaseは変更しない)。 */
export function mapClasses(codebase: Codebase, transform: (codeClass: CodeClass) => CodeClass): Codebase {
  return {
    files: codebase.files.map((file) => ({ ...file, classes: file.classes.map(transform) })),
  };
}

/** クラスのフィールド。省略時は []。 */
export function fieldsOf(codeClass: CodeClass): readonly Field[] {
  return codeClass.fields ?? [];
}

/** 処理が触る(読む・書く)フィールドのID。重複なし、reads → writes の順。 */
export function touchedFieldIds(fragment: Fragment): string[] {
  return [...new Set([...(fragment.reads ?? []), ...(fragment.writes ?? [])])];
}

export function findField(codebase: Codebase, fieldId: string): Field | undefined {
  return allClasses(codebase)
    .flatMap((codeClass) => fieldsOf(codeClass))
    .find((field) => field.id === fieldId);
}

export function findClassOfField(codebase: Codebase, fieldId: string): CodeClass | undefined {
  return allClasses(codebase).find((codeClass) => fieldsOf(codeClass).some((field) => field.id === fieldId));
}

/** protected の空宣言を持つクラスは抽象クラス役。 */
export function isAbstractLike(codeClass: CodeClass): boolean {
  return codeClass.methods.some((method) => method.visibility === 'protected' && method.fragments.length === 0);
}
