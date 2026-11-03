import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/** 中級4・中級5で共通の補助コード(同じ初期コードを使うため)。売上のサンプルデータと帳票の型。実行日時は固定値。 */
export const salesReportRuntime: Pick<StageRuntime, 'entryMethodId' | 'entryArguments' | 'support'> = {
  entryMethodId: 'method-download-report',
  entryArguments: ['SampleData.Input'],
  support: [
    logFile,
    supportFile('SalesReport.cs', `
public enum TaxCategory
{
    Standard,
    Reduced,
}

public class Sale
{
    public DateTime Date;
    public int ProductId;
    public int Quantity;
    public decimal Amount;
}

public static class Catalog
{
    public static string NameOf(int productId) => productId switch { 1 => "コーヒー豆", 2 => "紅茶", _ => "雑貨" };

    public static TaxCategory CategoryOf(int productId) => productId == 3 ? TaxCategory.Standard : TaxCategory.Reduced;
}

public class SalesRow
{
    public SalesRow(int productId, int quantity, decimal amount)
    {
        ProductName = Catalog.NameOf(productId);
        TaxCategory = Catalog.CategoryOf(productId);
        Quantity = quantity;
        Amount = amount;
    }

    public string ProductName { get; }

    public TaxCategory TaxCategory { get; }

    public int Quantity { get; }

    public decimal Amount { get; }
}

public class SalesReport
{
    public List<SalesRow> Rows { get; set; } = new();

    public decimal Subtotal => Rows.Sum(row => row.Amount);

    public decimal TaxAmount { get; set; }

    public decimal Total { get; set; }
}

public class ReportInput
{
    public DateTime StartDate;
    public DateTime EndDate;
    public string Format;
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}
`),
    supportFile('SampleData.cs', `
public static class SampleData
{
    public static readonly (DateTime Start, DateTime End) ReportWindow = (new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));

    public static readonly ReportInput Input = new() { StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 31), Format = "csv" };

    public static readonly List<Sale> Sales = new()
    {
        new Sale { Date = new DateTime(2026, 10, 3), ProductId = 1, Quantity = 4, Amount = 4800m },
        new Sale { Date = new DateTime(2026, 10, 12), ProductId = 2, Quantity = 2, Amount = 1600m },
        new Sale { Date = new DateTime(2026, 10, 20), ProductId = 3, Quantity = 1, Amount = 2500m },
        new Sale { Date = new DateTime(2026, 10, 25), ProductId = 1, Quantity = 1, Amount = 1200m },
        new Sale { Date = new DateTime(2026, 8, 25), ProductId = 2, Quantity = 3, Amount = 2400m },
    };
}
`),
  ],
};
