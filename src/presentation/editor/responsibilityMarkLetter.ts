/** 0始まりの印番号を A, B, ..., Z, AA ... の英字にする。 */
export function responsibilityMarkLetter(number: number): string {
  let remainder = number + 1;
  let letter = '';
  while (remainder > 0) {
    remainder -= 1;
    letter = String.fromCharCode(65 + (remainder % 26)) + letter;
    remainder = Math.floor(remainder / 26);
  }
  return letter;
}
