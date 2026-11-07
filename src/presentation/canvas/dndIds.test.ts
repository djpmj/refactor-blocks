import { describe, expect, it } from 'vitest';
import { TRAY_FILE_ID } from '../../domain/blank/tray';
import { classDropId, fileDropId, isEmptyAreaDrop } from './dndIds';

describe('isEmptyAreaDrop', () => {
  it('ドロップ先が無ければ余白', () => {
    // Act
    const result = isEmptyAreaDrop(null);

    // Assert
    expect(result).toBe(true);
  });

  it('部品置き場のファイルは余白として扱う', () => {
    // Act
    const result = isEmptyAreaDrop(fileDropId(TRAY_FILE_ID));

    // Assert
    expect(result).toBe(true);
  });

  it('通常のファイルは余白ではない', () => {
    // Act
    const result = isEmptyAreaDrop(fileDropId('file-order'));

    // Assert
    expect(result).toBe(false);
  });

  it('クラスは余白ではない', () => {
    // Act
    const result = isEmptyAreaDrop(classDropId('class-tax'));

    // Assert
    expect(result).toBe(false);
  });
});
