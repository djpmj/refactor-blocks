import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 中級10: 会員ランクごとの if 分岐を、ランクごとのクラスに分ける。
 * 入口は PriceCalculator.quotePrice にする。CheckoutService は、初期状態では実装のないインターフェース MemberRank を呼ぶだけなので、初期状態では実行できない。
 * ランクごとの2つの処理は、どちらも同じ引数(items・rank・結果の入れ物)の void にして、インターフェースを実装できる形にそろえる。
 */
export const intermediateMemberRankBranchingRuntime: StageRuntime = {
  entryMethodId: 'method-quote-price',
  entryArguments: ['SampleData.Items', '"Premium"', 'new QuoteResult()'],
  bindings: { MemberRank: 'RegularRank' },
  support: [
    logFile,
    supportFile('Membership.cs', `
public class OrderItem
{
    public int Quantity;
    public decimal UnitPrice;
    public bool IsValid = true;
}

public class QuoteResult
{
    public decimal Amount;
}

public class Order
{
    public Order(List<OrderItem> items, decimal total)
    {
        Items = items;
        Total = total;
    }

    public int Id => 5001;

    public List<OrderItem> Items { get; }

    public decimal Total { get; }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public static class ZoneResolver
{
    public static string Resolve(string address) => address.StartsWith("東京") ? "関東" : "その他";
}

public static class ShippingRates
{
    public static decimal Calculate(string zone, decimal weight) => zone == "関東" ? 500m + weight * 100m : 800m + weight * 150m;
}

public static class FakeRepository
{
    public static void Save(Order order)
    {
        Console.WriteLine($"[DB] 注文 {order.Id} を保存しました");
    }
}

public static class SampleData
{
    public static readonly List<OrderItem> Items = new()
    {
        new OrderItem { Quantity = 3, UnitPrice = 1000m },
        new OrderItem { Quantity = 2, UnitPrice = 450m },
    };
}
`),
  ],
};
