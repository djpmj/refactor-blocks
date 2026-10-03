import { describe, expect, it } from 'vitest';
import { deleteClass } from '../../domain/codebase/deleteClass';
import { deleteFile } from '../../domain/codebase/deleteFile';
import { stages } from './stageCatalog';

function stageCodebase(stageId: string) {
  const stage = stages.find((item) => item.id === stageId);
  if (stage === undefined) throw new Error(`stage not found: ${stageId}`);
  return stage.codebase;
}

describe('class and file deletion code guard', () => {
  it('中級1では Order ファイルとクラスを削除できない', () => {
    // Arrange
    const codebase = stageCodebase('intermediate-cyclic-dependency');
    // Act / Assert
    expect(deleteFile(codebase, 'file-order')).toEqual({ ok: false, error: 'has-code' });
    expect(deleteClass(codebase, 'class-order')).toEqual({ ok: false, error: 'has-code' });
  });

  it('上級2では PaymentGateway ファイルを削除できない', () => {
    // Arrange
    const codebase = stageCodebase('advanced-payment-gateway-interface');
    // Act / Assert
    expect(deleteFile(codebase, 'file-payment-gateway')).toEqual({ ok: false, error: 'has-code' });
  });

  it('上級5では BaseExporter ファイルを削除できない', () => {
    // Arrange
    const codebase = stageCodebase('advanced-collapse-hierarchy');
    // Act / Assert
    expect(deleteFile(codebase, 'file-base-exporter')).toEqual({ ok: false, error: 'has-code' });
  });
});
