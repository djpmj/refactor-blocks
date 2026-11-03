import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級5: 子が1つだけの継承(BaseExporter → CsvExporter)を畳む。
 * 入口は SalesController.downloadSalesCsv。売上は決まった3件を返す偽物のリポジトリから取る。
 */
export const advancedCollapseHierarchyRuntime: StageRuntime = {
  entryMethodId: 'method-download-sales-csv',
  // initial・01: BaseExporter.escapeValue が子クラスの quoteChar を呼ぶが、基底クラスからは見えないのでビルドに失敗する(CS0103。この循環が教材の題材)。
  // 02 で escapeValue を CsvExporter へ移すとビルドできる
  expectedBuildFailures: ['initial', '01'],
  entryArguments: ['SampleData.Query'],
  support: [
    logFile,
    supportFile('Sales.cs', `
public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class Sale
{
    public string ProductName;
    public decimal Amount;
}

public class SalesRow
{
    public SalesRow(string productName, decimal amount)
    {
        ProductName = productName;
        Amount = amount;
    }

    public string ProductName { get; }

    public decimal Amount { get; }

    public IEnumerable<string> Values => new[] { ProductName, Amount.ToString("0") };
}

public class SalesQuery
{
    public static readonly DateTime Minimum = new(2020, 1, 1);

    public static readonly DateTime Maximum = new(2030, 12, 31);

    public DateTime StartDate;
    public DateTime EndDate;
}

public static class FakeSalesRepository
{
    public static List<Sale> Find(DateTime start, DateTime end) => new()
    {
        new Sale { ProductName = "ノート", Amount = 1200m },
        new Sale { ProductName = "ペン,黒", Amount = 450m },
        new Sale { ProductName = "付箋", Amount = 300m },
    };
}

public static class SampleData
{
    public static readonly SalesQuery Query = new()
    {
        StartDate = new DateTime(2026, 10, 1),
        EndDate = new DateTime(2026, 10, 31),
    };
}
`),
  ],
};
