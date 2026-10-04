import { accessorFieldAccess, allClasses, type Codebase, type Method } from './Codebase';

export type FieldAccess = 'read' | 'write' | 'read-write';
export type FieldUsage = { readonly method: Method; readonly access: FieldAccess };

/** フィールドを直接またはアクセサ経由で使うメソッドを、クラス内の順に返す。 */
export function fieldUsage(codebase: Codebase, fieldId: string): FieldUsage[] {
  return allClasses(codebase).flatMap((codeClass) => codeClass.methods.flatMap((method) => {
    const reads = method.fragments.some((fragment) =>
      (fragment.reads ?? []).includes(fieldId) || accessorFieldAccess(codebase, fragment).reads.includes(fieldId),
    );
    const writes = method.fragments.some((fragment) =>
      (fragment.writes ?? []).includes(fieldId) || accessorFieldAccess(codebase, fragment).writes.includes(fieldId),
    );
    if (!reads && !writes) return [];
    let access: FieldAccess = 'write';
    if (reads && writes) access = 'read-write';
    else if (reads) access = 'read';
    return [{ method, access }];
  }));
}
