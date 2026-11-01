import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/** チュートリアル1: 月次レポート。売上データはサンプルデータから引数で渡す(分けたクラスからも使えるようにする)。 */
export const tutorialExtractMethodRuntime: StageRuntime = {
  entryMethodId: 'method-print-monthly-report',
  entryArguments: ['SampleData.Sales', 'SampleData.CurrentMonth', 'SampleData.PreviousMonth'],
  support: [
    logFile,
    supportFile('Sale.cs', `
public class Sale
{
    public int Month;
    public decimal Amount;
    public string ProductName;
}
`),
    supportFile('SampleData.cs', `
public static class SampleData
{
    public const int CurrentMonth = 10;
    public const int PreviousMonth = 9;

    public static readonly List<Sale> Sales = new()
    {
        new Sale { Month = 9, ProductName = "りんご", Amount = 1200m },
        new Sale { Month = 9, ProductName = "みかん", Amount = 800m },
        new Sale { Month = 10, ProductName = "りんご", Amount = 1500m },
        new Sale { Month = 10, ProductName = "みかん", Amount = 1000m },
        new Sale { Month = 10, ProductName = "りんご", Amount = 500m },
    };
}
`),
  ],
};
