import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級13: クーポンが無い(null)ときの扱いを、何もしない既定のクラス NoCoupon へ集める(Null Object)。
 * 入口は CartService.showCart(null の分岐を「割引」と「表示」の2つとも通る)。
 * 完成形では Coupon の実装が PercentCoupon・NoCoupon の2つになり、決めないと曖昧になるので、初期と同じ出力になる PercentCoupon を選ぶ。
 * 注文のデータは、ゲームのクラスとは別の補助のクラス OrderData に持たせ、メソッドの引数で渡す。決済は1行出す偽物。
 */
export const advancedNullObjectRuntime: StageRuntime = {
  entryMethodId: 'method-coupon-show-cart',
  entryArguments: ['SampleData.Order'],
  bindings: { Coupon: 'PercentCoupon' },
  // 途中の手順 03〜08 は、メソッドを別クラスへ移した直後で、移したメソッドがまだ private のままなので呼び出し元からビルドできない(完成形までに public にする)。
  expectedBuildFailures: ['03', '04', '05', '06', '07', '08'],
  support: [
    logFile,
    supportFile('OrderData.cs', `
public class OrderItem
{
    public decimal UnitPrice;
    public int Quantity;
}

public class OrderData
{
    public int Id;
    public List<OrderItem> Items = new();
    public decimal Subtotal;
    public decimal Discount;
    public decimal Total;
    public string? CouponCode;
    public string CouponLabel = "";
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public static class FakePayment
{
    public static void Charge(int orderId, decimal total) => Console.WriteLine($"[決済] 注文 {orderId} を {total} 円で決済しました");
}

public static class CouponCatalog
{
    public static decimal RateOf(string code) => 0.1m;
}

public static class SampleData
{
    public static readonly OrderData Order = new()
    {
        Id = 1001,
        Items = new List<OrderItem>
        {
            new() { UnitPrice = 1200m, Quantity = 2 },
            new() { UnitPrice = 800m, Quantity = 1 },
        },
        CouponCode = null,
    };
}
`),
  ],
};
