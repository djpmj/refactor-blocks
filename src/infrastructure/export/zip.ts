import type { ProjectFile } from '../../domain/codebase/csharpProject';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const UTF8_FLAG = 0x0800;
// 日付は固定(1980-01-01 00:00)にして、同じ入力から同じ zip になるようにする
const DOS_DATE = 0x0021;

type Entry = { readonly name: Uint8Array; readonly data: Uint8Array; readonly crc: number; readonly offset: number };

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [...u16(value & 0xffff), ...u16(value >>> 16)];
}

function localHeader(entry: Entry): number[] {
  return [
    ...u32(0x04034b50), ...u16(20), ...u16(UTF8_FLAG), ...u16(0), ...u16(0), ...u16(DOS_DATE),
    ...u32(entry.crc), ...u32(entry.data.length), ...u32(entry.data.length), ...u16(entry.name.length), ...u16(0),
  ];
}

function centralHeader(entry: Entry): number[] {
  return [
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(UTF8_FLAG), ...u16(0), ...u16(0), ...u16(DOS_DATE),
    ...u32(entry.crc), ...u32(entry.data.length), ...u32(entry.data.length), ...u16(entry.name.length),
    ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(entry.offset),
  ];
}

/** 無圧縮(STORE)の zip を作る。ファイル名は UTF-8。 */
export function createZip(files: readonly ProjectFile[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const entries = files.map((file): Entry => {
    const data = encoder.encode(file.content);
    const entry = { name: encoder.encode(file.path), data, crc: crc32(data), offset };
    const parts = [Uint8Array.from(localHeader(entry)), entry.name, data];
    chunks.push(...parts);
    offset += parts.reduce((sum, part) => sum + part.length, 0);
    return entry;
  });
  const centralStart = offset;
  const central = entries.flatMap((entry) => [Uint8Array.from(centralHeader(entry)), entry.name]);
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(centralStart), ...u16(0)]);
  const all = [...chunks, ...central, end];
  const zip = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of all) {
    zip.set(part, position);
    position += part.length;
  }
  return zip;
}

/** zip を Blob にして、ブラウザにダウンロードさせる。 */
export function downloadZip(name: string, files: readonly ProjectFile[]): void {
  const url = URL.createObjectURL(new Blob([createZip(files)], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
