import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 中級14: 印刷クラスが Order → Customer → Address とたどって宛先を作る。
 * 模範解答の3手目・7手目(Merge 直後)は、DeliveryNotePrinter が ShippingLabelPrinter の private メソッドを呼ぶのでビルドに失敗する(次の移動で解消)。
 * Order・Customer は解答後にコンストラクタ注入されるので、補助コードには書かない。
 * Address のフィールドの初期値は、補助コードの partial クラスの引数なしコンストラクタで与える(中級6と同じ)。
 */
export const intermediateLawOfDemeterRuntime: StageRuntime = {
  entryMethodId: 'method-print-label',
  entryArguments: ['"1Z999AA10123456784"'],
  expectedBuildFailures: ['03', '07'],
  support: [
    logFile,
    supportFile('SampleData.cs', `
public static class SampleData
{
    public static readonly DateTime Today = new(2026, 11, 1);
}

public partial class Address
{
    public Address()
    {
        postalCode = "100-0001";
        prefecture = "東京都";
        city = "千代田区";
        street = "千代田1-1";
    }
}
`),
  ],
};
