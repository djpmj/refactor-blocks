import { describe, expect, it } from 'vitest';
import { mapClasses, type CodeClass, type Codebase } from '../codebase/Codebase';
import { deleteClass } from '../codebase/deleteClass';
import { moveMethod } from '../codebase/moveMethod';
import { moveMethodToNewClass } from '../codebase/moveToNewHome';
import { addInterface, setSuperclass } from '../codebase/setSuperclass';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import type { ChangeRequest } from './ChangeRequest';
import { withChangePart } from './changePart';
import { measurePlacement, type Placement } from './measurePlacement';

const PART_ID = 'method-part-req-1';
const taxRequest: ChangeRequest = { id: 'req-1', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8, partName: 'addReducedTax' };
const gatewayRequest: ChangeRequest = { ...taxRequest, responsibility: 'gateway', kind: 'extend', partName: 'chargeWithPaypay' };
const newIds = { classId: 'class-new', fileId: 'file-new' };

function unwrap<T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!result.ok) throw new Error(`失敗: ${String(result.error)}`);
  return result.value;
}

function placement(base: Codebase, implemented: Codebase, request: ChangeRequest): Placement {
  return unwrap(measurePlacement(base, implemented, request));
}

function method(id: string, name: string, fragments: CodeClass['methods'][number]['fragments'] = []): CodeClass['methods'][number] {
  return { id, name, visibility: 'public', fragments };
}

/** Service.run → Gateway.charge(インターフェース役)。StripeGateway は Gateway を実装する具象。UnusedPort は誰からも呼ばれない。 */
function gatewayCodebase(): Codebase {
  const classes: CodeClass[] = [
    {
      id: 'class-service',
      name: 'Service',
      methods: [method('method-run', 'run', [{ ...fragment('f-run', 5, 'orchestration'), uses: ['method-gateway-charge'] }])],
    },
    { id: 'class-gateway', name: 'Gateway', methods: [method('method-gateway-charge', 'charge')] },
    {
      id: 'class-stripe',
      name: 'StripeGateway',
      interfaceIds: ['class-gateway'],
      methods: [method('method-stripe-charge', 'stripeCharge', [fragment('f-stripe', 9, 'gateway')])],
    },
    { id: 'class-port', name: 'UnusedPort', methods: [method('method-port-run', 'portRun')] },
  ];
  return { files: classes.map((codeClass) => ({ id: `file-${codeClass.id}`, path: `src/${codeClass.name}.ts`, classes: [codeClass] })) };
}

function toExistingClass(base: Codebase, request: ChangeRequest, classId: string): Codebase {
  return unwrap(moveMethod(withChangePart(base, request), PART_ID, classId));
}

/** 部品を新しいクラス(NewClass)へ出し、必要なら親を設定する。 */
function toNewClass(base: Codebase, request: ChangeRequest, parent?: { name: string; kind: 'extends' | 'implements' }): Codebase {
  const moved = unwrap(moveMethodToNewClass(withChangePart(base, request), PART_ID, newIds));
  if (parent === undefined) return moved;
  return parent.kind === 'extends'
    ? unwrap(setSuperclass(moved, newIds.classId, parent.name))
    : unwrap(addInterface(moved, newIds.classId, parent.name));
}

describe('measurePlacement: ルールの変更(sampleCodebase)', () => {
  it('部品が部品置き場に残っていると unplaced-part', () => {
    // Arrange
    const base = sampleCodebase();

    // Act
    const result = measurePlacement(base, withChangePart(base, taxRequest), taxRequest);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unplaced-part' });
  });

  it('部品のクラスごと消しても unplaced-part', () => {
    // Arrange
    const base = sampleCodebase();
    const implemented = unwrap(deleteClass(toNewClass(base, taxRequest), newIds.classId));

    // Act
    const result = measurePlacement(base, implemented, taxRequest);

    // Assert
    expect(result).toEqual({ ok: false, error: 'unplaced-part' });
  });

  it('OrderService へ置くと、そのクラスを触り、無関係な責務が2種類同居する', () => {
    // Arrange
    const base = sampleCodebase();

    // Act
    const result = placement(base, toExistingClass(base, taxRequest, 'class-order'), taxRequest);

    // Assert
    expect(result).toMatchObject({
      partClassId: 'class-order',
      modifiedClassIds: ['class-order'],
      otherResponsibilities: 2,
      addedResponsibilityClasses: 0,
      attachment: 'existing-class',
    });
  });

  it('TaxCalculator へ置くと、責務を持つクラスが1つ増える', () => {
    // Arrange
    const base = sampleCodebase();

    // Act
    const result = placement(base, toExistingClass(base, taxRequest, 'class-tax'), taxRequest);

    // Assert
    expect(result).toMatchObject({ modifiedClassIds: ['class-tax'], otherResponsibilities: 0, addedResponsibilityClasses: 1 });
  });

  it('余白へ(継承なし)置くと、既存は触らず未接続になる', () => {
    // Arrange
    const base = sampleCodebase();

    // Act
    const result = placement(base, toNewClass(base, taxRequest), taxRequest);

    // Assert
    expect(result).toMatchObject({ partClassName: 'NewClass', modifiedClassIds: [], attachment: 'none' });
  });

  it('OrderService へ移してから TaxCalculator へ移し直すと、OrderService は触っていない扱い', () => {
    // Arrange
    const base = sampleCodebase();
    const toOrder = toExistingClass(base, taxRequest, 'class-order');
    const implemented = unwrap(moveMethod(toOrder, PART_ID, 'class-tax'));

    // Act
    const result = placement(base, implemented, taxRequest);

    // Assert
    expect(result.modifiedClassIds).toEqual(['class-tax']);
  });

  it('部品とは別に、既存クラスの継承元を変える・既存クラスを消すと、そのクラスも触った扱い', () => {
    // Arrange
    const base = sampleCodebase();
    const withParent = unwrap(setSuperclass(toNewClass(base, taxRequest), 'class-tax', 'OrderService'));
    const withoutOrder = unwrap(deleteClass(toNewClass(base, taxRequest), 'class-order'));

    // Act
    const changed = placement(base, withParent, taxRequest);
    const deleted = placement(base, withoutOrder, taxRequest);

    // Assert
    expect(changed.modifiedClassIds).toEqual(['class-tax']);
    expect(deleted.modifiedClassIds).toEqual(['class-order']);
  });

  it("'call' の責務は無関係な責務に数えない", () => {
    // Arrange
    const base = mapClasses(sampleCodebase(), (codeClass) =>
      codeClass.id === 'class-order'
        ? { ...codeClass, methods: [...codeClass.methods, method('method-x', 'x', [fragment('f-call', 1, 'call')])] }
        : codeClass,
    );

    // Act
    const result = placement(base, toExistingClass(base, taxRequest, 'class-order'), taxRequest);

    // Assert
    expect(result.otherResponsibilities).toBe(2);
  });

  it('base と implemented を変更しない', () => {
    // Arrange
    const base = sampleCodebase();
    const implemented = toExistingClass(base, taxRequest, 'class-order');
    const snapshots = [structuredClone(base), structuredClone(implemented)];

    // Act
    placement(base, implemented, taxRequest);

    // Assert
    expect([base, implemented]).toEqual(snapshots);
  });
});

describe('measurePlacement: つながり方(gatewayCodebase)', () => {
  it('新クラスが Gateway を implements すると abstract', () => {
    // Arrange
    const base = gatewayCodebase();

    // Act
    const result = placement(base, toNewClass(base, gatewayRequest, { name: 'Gateway', kind: 'implements' }), gatewayRequest);

    // Assert
    expect(result).toMatchObject({ attachment: 'abstract', attachedClassId: 'class-gateway', modifiedClassIds: [] });
  });

  it('新クラスが StripeGateway を extends すると concrete', () => {
    // Arrange
    const base = gatewayCodebase();

    // Act
    const result = placement(base, toNewClass(base, gatewayRequest, { name: 'StripeGateway', kind: 'extends' }), gatewayRequest);

    // Assert
    expect(result).toMatchObject({ attachment: 'concrete', attachedClassId: 'class-stripe' });
  });

  it('StripeGateway が実装を外していると、それを extends しても none', () => {
    // Arrange
    const base = mapClasses(gatewayCodebase(), (codeClass) => (codeClass.id === 'class-stripe' ? { ...codeClass, interfaceIds: undefined } : codeClass));

    // Act
    const result = placement(base, toNewClass(base, gatewayRequest, { name: 'StripeGateway', kind: 'extends' }), gatewayRequest);

    // Assert
    expect(result.attachment).toBe('none');
  });

  it('呼ばれていない UnusedPort を implements しても none', () => {
    // Arrange
    const base = gatewayCodebase();

    // Act
    const result = placement(base, toNewClass(base, gatewayRequest, { name: 'UnusedPort', kind: 'implements' }), gatewayRequest);

    // Assert
    expect(result.attachment).toBe('none');
  });

  it('新クラス → 別の新クラス → Gateway の順でも、間の新クラスを飛ばして abstract', () => {
    // Arrange
    const base = gatewayCodebase();
    const middle: CodeClass = { id: 'class-middle', name: 'Middle', methods: [], interfaceIds: ['class-gateway'] };
    const withMiddle: Codebase = { files: [...base.files, { id: 'file-middle', path: 'src/Middle.ts', classes: [middle] }] };
    const implemented = unwrap(setSuperclass(toNewClass(withMiddle, gatewayRequest), newIds.classId, 'Middle'));

    // Act
    const result = placement(base, implemented, gatewayRequest);

    // Assert
    expect(result).toMatchObject({ attachment: 'abstract', attachedClassId: 'class-gateway' });
  });

  it('superclassId が輪になっていても止まって none を返す', () => {
    // Arrange
    const base = mapClasses(gatewayCodebase(), (codeClass) => {
      if (codeClass.id === 'class-stripe') return { ...codeClass, superclassId: 'class-port', interfaceIds: undefined };
      if (codeClass.id === 'class-port') return { ...codeClass, superclassId: 'class-stripe' };
      return codeClass;
    });
    const implemented = mapClasses(toNewClass(base, gatewayRequest), (codeClass) =>
      codeClass.id === newIds.classId ? { ...codeClass, superclassId: 'class-port' } : codeClass,
    );

    // Act
    const result = placement(base, implemented, gatewayRequest);

    // Assert
    expect(result.attachment).toBe('none');
  });
});
