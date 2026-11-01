import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, mailFakesFile, mailMessageFile, supportFile, unitOfWorkFile } from './supportFiles';

/** 初級2: 請求書の発行。PDF・ストレージ・メール・履歴は、何をしたかを1行出す偽物にする。日時は固定値(SampleData.Now)。 */
export const beginnerInvoiceServiceRuntime: StageRuntime = {
  entryMethodId: 'method-issue-invoice',
  entryArguments: ['SampleData.Items', '0.1m', 'SampleData.Invoice', 'CancellationToken.None'],
  support: [
    logFile,
    unitOfWorkFile,
    mailMessageFile,
    mailFakesFile,
    supportFile('Invoice.cs', `
public class InvoiceItem
{
    public int Quantity;
    public decimal UnitPrice;
}

public class Invoice
{
    public string Number;
    public decimal Total;
}

public class InvoiceDeliveryHistory
{
    public InvoiceDeliveryHistory(string number, string recipient, DateTimeOffset sentAt)
    {
        Number = number;
        Recipient = recipient;
        SentAt = sentAt;
    }

    public string Number { get; }

    public string Recipient { get; }

    public DateTimeOffset SentAt { get; }
}
`),
    supportFile('FakePdf.cs', `
public class PdfPage
{
    public void DrawInvoice(Invoice invoice)
    {
        Console.WriteLine($"[PDF] 請求書 {invoice.Number} (合計 {invoice.Total}) を描画しました");
    }
}

public class PdfDocument
{
}

public static class FakePdfRenderer
{
    public static PdfPage CreatePage()
    {
        return new PdfPage();
    }

    public static PdfDocument Render(PdfPage page)
    {
        Console.WriteLine("[PDF] ページを PDF に変換しました");
        return new PdfDocument();
    }
}
`),
    supportFile('FakeStorage.cs', `
public static class FakeStorage
{
    public static Task UploadAsync(string key, PdfDocument document, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[STORAGE] {key} をアップロードしました");
        return Task.CompletedTask;
    }

    public static Task SetMetadataAsync(string key, string invoiceNumber, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[STORAGE] {key} にメタデータ {invoiceNumber} を設定しました");
        return Task.CompletedTask;
    }

    public static Task<Stream> DownloadAsync(string key, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[STORAGE] {key} をダウンロードしました");
        return Task.FromResult<Stream>(new MemoryStream());
    }
}

public static class FakeHistoryRepository
{
    public static Task AddAsync(InvoiceDeliveryHistory history, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[DB] 請求書 {history.Number} の送信履歴({history.Recipient})を追加しました");
        return Task.CompletedTask;
    }
}
`),
    supportFile('SampleData.cs', `
public static class SampleData
{
    public static readonly DateTimeOffset Now = new(2026, 11, 1, 9, 0, 0, TimeSpan.Zero);

    public static readonly List<InvoiceItem> Items = new()
    {
        new InvoiceItem { Quantity = 3, UnitPrice = 1500m },
        new InvoiceItem { Quantity = 1, UnitPrice = 2800m },
    };

    public static readonly Invoice Invoice = new() { Number = "INV-0001" };
}
`),
  ],
};
