import type { Visibility } from '../../domain/codebase/Codebase';

const VISIBILITY_MEANINGS = 'public: どのクラスからも呼べる / protected: このクラスと子クラスから呼べる / private: このクラスの中だけで呼べる';
const INITIAL_VISIBILITY_NOTE = 'ステージを始めたときの可視性には、いつでも戻せます';
const ABSTRACT_IMPLEMENTATION_NOTE = '親クラスの抽象メソッドを実装しているので、public / protected も選べます';

export function describeVisibility(input: {
  readonly current: Visibility;
  readonly disabled: readonly Visibility[];
  readonly implementsAbstract: boolean;
}): readonly string[] {
  const disabled = input.disabled.filter((visibility) => visibility !== input.current);
  return [
    VISIBILITY_MEANINGS,
    ...(disabled.length === 0
      ? []
      : [`${disabled.join(' / ')} が選べないのは、そこまで広げて呼んでいるクラスが無いからです(必要のない公開を避けるため)`]),
    INITIAL_VISIBILITY_NOTE,
    ...(input.implementsAbstract ? [ABSTRACT_IMPLEMENTATION_NOTE] : []),
  ];
}
