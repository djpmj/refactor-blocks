import { describe, expect, it } from 'vitest';
import { crc32, createZip } from './zip';

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

describe('createZip', () => {
  it('先頭が PK\\x03\\x04、末尾に終端レコードがあり、ファイル数が合う', () => {
    // Arrange
    const files = [{ path: 'a/b.txt', content: 'hello' }, { path: 'c.txt', content: 'world' }];
    // Act
    const zip = createZip(files);
    // Assert
    expect([...zip.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const end = zip.length - 22;
    expect([...zip.slice(end, end + 4)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    expect(view(zip).getUint16(end + 10, true)).toBe(2);
  });

  it('既知の文字列の CRC-32 が正しい', () => {
    // Arrange / Act / Assert
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('日本語のファイル名に UTF-8 フラグ(汎用ビット11)が立つ', () => {
    // Arrange
    const name = '日本語.cs';
    // Act
    const zip = createZip([{ path: name, content: 'x' }]);
    // Assert
    expect(view(zip).getUint16(6, true) & 0x0800).toBe(0x0800);
    expect(new TextDecoder().decode(zip.slice(30, 30 + new TextEncoder().encode(name).length))).toBe(name);
  });
});
