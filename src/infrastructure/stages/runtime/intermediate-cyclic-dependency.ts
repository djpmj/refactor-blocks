import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/** 中級1: 注文・顧客・在庫。Order と Customer が互いを呼び合う初期状態も、プロパティで受け渡して実行できる。 */
export const intermediateCyclicDependencyRuntime: StageRuntime = {
  entryMethodId: 'method-checkout',
  entryArguments: ['1001', '42', '7', '2', '"tok_123"'],
  support: [
    logFile,
    supportFile('Orders.cs', `
public enum MemberRank
{
    Regular,
    Premium,
    Vip,
}

public static class DiscountRates
{
    public static decimal For(MemberRank rank) => rank switch
    {
        MemberRank.Vip => 0.20m,
        MemberRank.Premium => 0.10m,
        _ => 0m,
    };
}

public class OrderLine
{
    public int Quantity;
    public decimal UnitPrice;
}
`),
    supportFile('Fakes.cs', `
public static class FakeOrderStore
{
    public static List<OrderLine> GetLines(int orderId)
    {
        Console.WriteLine($"[DB] 注文 {orderId} の明細を読み込みました");
        return new List<OrderLine>
        {
            new OrderLine { Quantity = 2, UnitPrice = 1200m },
            new OrderLine { Quantity = 1, UnitPrice = 3000m },
        };
    }

    public static int CountByCustomer(int customerId)
    {
        Console.WriteLine($"[DB] 顧客 {customerId} の過去の注文数を数えました");
        return 12;
    }
}

public static class FakeInventoryStore
{
    public static void Reserve(int productId, int quantity)
    {
        Console.WriteLine($"[在庫] 商品 {productId} を {quantity} 個引き当てました");
    }
}

public class PaymentResult
{
    public bool Succeeded;
    public string ErrorMessage;
}

public class PaymentException : Exception
{
    public PaymentException(string message) : base(message) { }
}

public static class FakePaymentGateway
{
    public static PaymentResult Charge(decimal amount, string token)
    {
        Console.WriteLine($"[決済] {token} に {amount} 円を請求しました");
        return new PaymentResult { Succeeded = true };
    }
}
`),
  ],
};
