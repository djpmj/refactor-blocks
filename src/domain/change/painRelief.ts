import type { PainSummary } from './changePain';

/** 「はっきり楽になる」の判定。どれか1つでも成り立てば true。 */
export function isClearlyRelieved(initial: PainSummary, current: PainSummary): boolean {
  return current.siteIds.length < initial.siteIds.length
    || current.classes < initial.classes
    || current.files < initial.files
    || current.readLines <= initial.readLines * 0.75
    || current.classLines <= initial.classLines * 0.75;
}
