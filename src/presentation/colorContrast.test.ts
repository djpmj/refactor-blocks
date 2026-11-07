import { describe, expect, it } from 'vitest';
import css from '../index.css?raw';

type Rgb = readonly [number, number, number];
type Mode = 'light' | 'dark';

function parseTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const line of block.split('\n')) {
    const [name, value] = line.trim().split(': ');
    if (name.startsWith('--') && line.includes(': ') && value.length === 8 && value.startsWith('#') && value.endsWith(';')) {
      tokens.set(name, value.slice(0, 7).toLowerCase());
    }
  }
  return tokens;
}

function themeTokens(source: string, mode: Mode): Map<string, string> {
  const darkStart = source.indexOf('@media (prefers-color-scheme: dark)');
  const light = parseTokens(source.slice(0, darkStart));
  if (mode === 'light') return light;
  const darkEnd = darkStart + source.slice(darkStart).search(/\r?\n\}\r?\n/);
  return new Map([...light, ...parseTokens(source.slice(darkStart, darkEnd))]);
}

function toRgb(hex: string): Rgb {
  const channel = (start: number): number => parseInt(hex.slice(start, start + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

function mix(a: string, b: string, ratioOfA: number): Rgb {
  const [ra, rb] = [toRgb(a), toRgb(b)];
  const blend = (i: 0 | 1 | 2): number => ra[i] * ratioOfA + rb[i] * (1 - ratioOfA);
  return [blend(0), blend(1), blend(2)];
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('contrastRatio', () => {
  it.each([
    { name: '白と黒は21', a: '#ffffff', b: '#000000', expected: 21 },
    { name: '同じ色どうしは1', a: '#4f6bed', b: '#4f6bed', expected: 1 },
    { name: '#767676と白は4.54', a: '#767676', b: '#ffffff', expected: 4.54 },
  ])('$name', ({ a, b, expected }) => {
    // Arrange / Act
    const ratio = contrastRatio(toRgb(a), toRgb(b));

    // Assert
    expect(ratio).toBeCloseTo(expected, 2);
  });
});

type Pair = { name: string; text: string; bg: string | { mixOf: string; percent: number; into: string } };

const pairs: Pair[] = [
  { name: '主ボタン', text: '--surface', bg: '--accent' },
  { name: 'implements', text: '--edge-implements', bg: '--surface' },
  { name: '達成バッジ', text: '--surface', bg: '--success' },
  { name: '公開マーク', text: '--public', bg: '--bg' },
  { name: '非公開マーク', text: '--private', bg: '--bg' },
  { name: '保護マーク', text: '--protected', bg: '--bg' },
  { name: '行数(ファイルの箱)', text: '--muted', bg: '--file-bg' },
  { name: '行数(メソッド)', text: '--muted', bg: '--bg' },
  { name: '控えめな文字', text: '--muted', bg: '--surface' },
  { name: '今: N件', text: '--answer-danger-text', bg: { mixOf: '--danger', percent: 8, into: '--surface' } },
  { name: 'クリア条件の進捗', text: '--success', bg: { mixOf: '--success', percent: 12, into: '--surface' } },
];

describe.each<Mode>(['light', 'dark'])('文字のコントラスト(%s)', (mode) => {
  it.each(pairs)('$name は 4.5:1 以上', ({ text, bg }) => {
    // Arrange
    const tokens = themeTokens(css, mode);
    const get = (name: string): string => tokens.get(name) ?? '';
    const bgRgb = typeof bg === 'string' ? toRgb(get(bg)) : mix(get(bg.mixOf), get(bg.into), bg.percent / 100);

    // Act
    const ratio = contrastRatio(toRgb(get(text)), bgRgb);

    // Assert
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('塗りの上の文字色', () => {
  it.each(['.button--primary', '.clear-condition--met .clear-condition__badge'])('%s は var(--surface)', (selector) => {
    // Arrange
    const rule = css.split('\n').find((line) => line.startsWith(`${selector} {`)) ?? '';

    // Act / Assert
    expect(rule).toContain('color: var(--surface)');
  });
});

describe('見逃しラベルの文字色', () => {
  it('ダークでも背景(--danger)に対し白文字のままで、従来より悪化しない', () => {
    // Arrange
    const rule = css.split('\n').find((line) => line.startsWith('.impact-highlight--missed .impact-highlight__label {')) ?? '';
    const danger = themeTokens(css, 'dark').get('--danger') ?? '';

    // Act
    const ratio = contrastRatio(toRgb('#ffffff'), toRgb(danger));

    // Assert
    expect(rule).toContain('color: #fff');
    expect(ratio).toBeGreaterThan(4.3);
  });
});
