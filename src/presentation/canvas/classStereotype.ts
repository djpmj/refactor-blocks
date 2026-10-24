import { isAbstractLike, isInterfaceLike, type CodeClass } from '../../domain/codebase/Codebase';

export type ClassStereotype = 'interface' | 'abstract';

export function classRoleName(stereotype: ClassStereotype | null): string {
  if (stereotype === 'interface') return 'インターフェース';
  if (stereotype === 'abstract') return '抽象クラス';
  return '';
}

export function classStereotype(codeClass: CodeClass): ClassStereotype | null {
  if (isInterfaceLike(codeClass)) return 'interface';
  if (isAbstractLike(codeClass)) return 'abstract';
  return null;
}
