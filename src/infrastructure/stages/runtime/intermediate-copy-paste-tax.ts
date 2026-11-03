import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, mailMessageFile, supportFile } from './supportFiles';

/**
 * 中級9: 注文・請求・見積に同じ「消費税を計算する」処理がコピペされている。
 * 3つの処理のコードは文字どおり同じにし、税を受け取る相手は共通の ITaxable 型にして、統合前後で引数の型が変わらないようにする。
 * 統合したメソッドを TaxCalculator へ移すまでの手順(04・05)は、別クラスから private メソッドを呼ぶことになるのでビルドに失敗する。
 */
export const intermediateCopyPasteTaxRuntime: StageRuntime = {
  entryMethodId: 'method-confirm-order',
  entryArguments: ['SampleData.Order', '7', '2', '0.10m'],
  expectedBuildFailures: ['04', '05'],
  support: [
    logFile,
    mailMessageFile,
    supportFile('Sales.cs', `
public interface ITaxable
{
    int Id { get; }

    decimal Subtotal { get; }

    void ApplyTax(decimal tax);
}

public class OrderItem
{
    public string Description;
    public int Quantity;
    public decimal UnitPrice;
}

public class InvoiceLine
{
    public InvoiceLine(string description, int quantity, decimal unitPrice)
    {
        Description = description;
        Quantity = quantity;
        UnitPrice = unitPrice;
    }

    public string Description { get; }

    public int Quantity { get; }

    public decimal UnitPrice { get; }
}

public class Order : ITaxable
{
    public int Id { get; set; }

    public string Number { get; set; }

    public List<OrderItem> Items { get; set; } = new();

    public decimal Subtotal => Items.Sum(item => item.Quantity * item.UnitPrice);

    public void ApplyTax(decimal tax)
    {
        Console.WriteLine($"[税] 注文 {Id} に消費税 {tax} 円を加えました");
    }
}

public class Invoice : ITaxable
{
    public Invoice(string number, List<InvoiceLine> lines)
    {
        Number = number;
        Lines = lines;
    }

    public int Id => 2001;

    public string Number { get; }

    public List<InvoiceLine> Lines { get; }

    public decimal Subtotal => Lines.Sum(line => line.Quantity * line.UnitPrice);

    public void ApplyTax(decimal tax)
    {
        Console.WriteLine($"[税] 請求書 {Number} に消費税 {tax} 円を加えました");
    }
}

public class Quote : ITaxable
{
    public Quote(List<OrderItem> items, decimal total, DateTime expiresAt)
    {
        Subtotal = total;
        ExpiresAt = expiresAt;
    }

    public int Id => 3001;

    public decimal Subtotal { get; }

    public DateTime ExpiresAt { get; }

    public void ApplyTax(decimal tax)
    {
        Console.WriteLine($"[税] 見積 {Id} に消費税 {tax} 円を加えました");
    }
}
`),
    supportFile('Fakes.cs', `
public static class FakeInventory
{
    public static void Reserve(int productId, int quantity)
    {
        Console.WriteLine($"[在庫] 商品 {productId} を {quantity} 個引き当てました");
    }
}

public static class FakeRepository
{
    public static void Save(ITaxable aggregate)
    {
        Console.WriteLine($"[DB] {aggregate.Id} を保存しました");
    }
}

public static class FakeMailer
{
    public static void Send(MailMessage message)
    {
        Console.WriteLine($"[MAIL] {message.To} 宛に「{message.Subject}」を送信しました ({message.Id})");
    }
}

public static class SampleData
{
    public static readonly Order Order = new()
    {
        Id = 1001,
        Number = "ORD-1001",
        Items = new List<OrderItem>
        {
            new OrderItem { Description = "ノート", Quantity = 3, UnitPrice = 400m },
            new OrderItem { Description = "ペン", Quantity = 5, UnitPrice = 150m },
        },
    };
}
`),
  ],
};
