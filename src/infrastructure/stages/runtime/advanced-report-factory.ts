import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級4: 週次・月次レポートの組み立て(重複)を ReportFactory に集める。
 * 入口は WeeklyReportController.exportWeeklyReport。送信先は、何をしたかを1行出す偽物。
 */
export const advancedReportFactoryRuntime: StageRuntime = {
  entryMethodId: 'method-export-weekly-report',
  // 03: 統合した buildReport が private のまま Weekly に残り、Monthly から呼ぶとビルドに失敗する(04 で ReportFactory へ移す)
  expectedBuildFailures: ['03'],
  entryArguments: ['SampleData.Sales', 'new DateTime(2026, 10, 26)', 'new DateTime(2026, 11, 1)'],
  support: [
    logFile,
    supportFile('Reports.cs', `
public class SaleRecord
{
    public string Category;
    public decimal Amount;
}

public class ReportRow
{
    public ReportRow(string category, decimal amount)
    {
        Category = category;
        Amount = amount;
    }

    public string Category { get; }

    public decimal Amount { get; }
}

public class Report
{
    public Report(DateTime periodStart, DateTime periodEnd, List<ReportRow> rows)
    {
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        Rows = rows;
    }

    public DateTime PeriodStart { get; }

    public DateTime PeriodEnd { get; }

    public List<ReportRow> Rows { get; }

    public void Validate()
    {
        if (Rows.Count == 0) throw new InvalidOperationException("レポートに行がありません");
    }
}

public static class FakeJson
{
    public static string Serialize(Report report) => $"{{\\"from\\":\\"{report.PeriodStart:yyyy-MM-dd}\\",\\"to\\":\\"{report.PeriodEnd:yyyy-MM-dd}\\",\\"rows\\":{report.Rows.Count}}}";
}

public static class FakeReportEndpoint
{
    public static void Post(string payload) => Console.WriteLine($"[HTTP] レポートを送信しました: {payload}");
}

public static class SampleData
{
    public static readonly List<SaleRecord> Sales = new()
    {
        new SaleRecord { Category = "本", Amount = 1200m },
        new SaleRecord { Category = "文具", Amount = 450m },
        new SaleRecord { Category = "本", Amount = 800m },
    };
}
`),
  ],
};
