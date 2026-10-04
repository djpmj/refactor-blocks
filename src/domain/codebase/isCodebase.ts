import type { Codebase } from './Codebase';

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStr(value: unknown): value is string {
  return typeof value === 'string';
}

function isStrArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isStr);
}

function allObjects(value: unknown, check: (item: Obj) => boolean): boolean {
  return Array.isArray(value) && value.every((item) => isObj(item) && check(item));
}

/** 任意項目: 無ければ true、あれば check を満たすこと。 */
function optional(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function isVisibility(value: unknown): boolean {
  return value === 'public' || value === 'private' || value === 'protected';
}

function isBool(value: unknown): boolean {
  return typeof value === 'boolean';
}

function isFragment(f: Obj): boolean {
  const requiredOk = isStr(f.id) && isStr(f.label) && isStr(f.responsibility) && typeof f.lines === 'number' && Number.isInteger(f.lines) && f.lines >= 0;
  const arraysOk = [f.uses, f.reads, f.writes].every((value) => optional(value, isStrArray));
  const textsOk = [f.suggestedName, f.duplicateGroup].every((value) => optional(value, isStr));
  return requiredOk && arraysOk && textsOk && optional(f.stub, isBool) && optional(f.accessor, isBool) && optional(f.code, isObj);
}

function isMethod(m: Obj): boolean {
  return isStr(m.id) && isStr(m.name) && isVisibility(m.visibility) && allObjects(m.fragments, isFragment);
}

function isField(f: Obj): boolean {
  return isStr(f.id) && isStr(f.name) && isVisibility(f.visibility) && optional(f.description, isStr) && optional(f.type, isObj);
}

function isClass(c: Obj): boolean {
  const inheritanceOk = optional(c.superclassId, isStr) && optional(c.interfaceIds, isStrArray);
  return isStr(c.id) && isStr(c.name) && allObjects(c.methods, isMethod) && inheritanceOk && optional(c.fields, (v) => allObjects(v, isField));
}

function isFile(f: Obj): boolean {
  return isStr(f.id) && isStr(f.path) && allObjects(f.classes, isClass);
}

/** 外(localStorage など)から読んだ値が Codebase の形かを調べる。信頼境界の入力検証。 */
export function isCodebase(value: unknown): value is Codebase {
  return isObj(value) && allObjects(value.files, isFile);
}
