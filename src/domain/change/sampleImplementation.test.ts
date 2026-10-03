import { describe, expect, it } from 'vitest';
import { allClasses, type CodeClass, type Codebase } from '../codebase/Codebase';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import type { ChangeRequest } from './ChangeRequest';
import { sampleImplementation } from './sampleImplementation';

const taxRequest: ChangeRequest = { id: 'req-1', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8, partName: 'addReducedTax' };
const gatewayRequest: ChangeRequest = { ...taxRequest, responsibility: 'gateway', kind: 'extend', partName: 'chargeWithPaypay' };

function method(id: string, name: string, fragments: CodeClass['methods'][number]['fragments'] = []): CodeClass['methods'][number] {
  return { id, name, visibility: 'public', fragments };
}

/** Service.run → Gateway.charge(インターフェース役)。StripeGateway は Gateway を実装する具象。 */
function gatewayCodebase(): Codebase {
  const classes: CodeClass[] = [
    { id: 'class-service', name: 'Service', methods: [method('method-run', 'run', [{ ...fragment('f-run', 5, 'orchestration'), uses: ['method-gateway-charge'] }])] },
    { id: 'class-gateway', name: 'Gateway', methods: [method('method-gateway-charge', 'charge')] },
    {
      id: 'class-stripe',
      name: 'StripeGateway',
      interfaceIds: ['class-gateway'],
      methods: [method('method-stripe-charge', 'stripeCharge', [fragment('f-stripe', 9, 'gateway')])],
    },
  ];
  return { files: classes.map((codeClass) => ({ id: `file-${codeClass.id}`, path: `src/${codeClass.name}.ts`, classes: [codeClass] })) };
}

function hasMethodNamed(codeClass: CodeClass, name: string): boolean {
  return codeClass.methods.some((candidate) => candidate.name === name);
}

describe('sampleImplementation', () => {
  it('機能の追加: インターフェースを実装する新しいクラスに置くのが100点', () => {
    // Arrange
    const base = gatewayCodebase();

    // Act
    const sample = sampleImplementation(base, gatewayRequest);

    // Assert
    expect(sample).toMatchObject({ target: { kind: 'new-class', implementing: 'Gateway' }, score: 100 });
  });

  it('図用のコードベースは、部品が置かれた最終形で、部品置き場を含まない', () => {
    // Arrange
    const base = gatewayCodebase();

    // Act
    const codebase = sampleImplementation(base, gatewayRequest)?.codebase;

    // Assert
    const classes = codebase === undefined ? [] : allClasses(codebase);
    const placed = classes.filter((codeClass) => hasMethodNamed(codeClass, 'chargeWithPaypay'));
    expect(placed.map((codeClass) => codeClass.interfaceIds)).toEqual([['class-gateway']]);
    expect(codebase?.files.some((file) => file.path === '部品置き場')).toBe(false);
  });

  it('ルールの変更: いちばん点の高い既存クラスに置く', () => {
    // Arrange
    const base = sampleCodebase();

    // Act
    const sample = sampleImplementation(base, taxRequest);

    // Assert
    expect(sample?.target.kind).toBe('existing-class');
    expect(sample?.score).toBe(90);
  });
});
