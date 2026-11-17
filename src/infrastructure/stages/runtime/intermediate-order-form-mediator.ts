import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 中級13: 呼び合う画面部品(CartList・CouponInput・ShippingSelector)を、仲介役 OrderFormMediator へつなぎ直す。
 * 入口は CartList.changeQuantity。呼び合いは循環しているが、各 refresh は他の部品を呼び返さないので、実行は止まる。
 */
export const intermediateOrderFormMediatorRuntime: StageRuntime = {
  entryMethodId: 'method-form-change-quantity',
  entryArguments: ['SampleData.Draft', '7', '3'],
  support: [
    logFile,
    supportFile('OrderDraft.cs', `
public class OrderLine
{
    public int ProductId;
    public int Quantity;
    public decimal UnitPrice;
    public decimal Weight;
    public bool Discounted;
}

public class OrderDraft
{
    public List<OrderLine> Lines = new();
    public string CouponCode;
    public string ShippingMethod;
    public decimal Discount;
    public decimal ShippingFee;

    public decimal Subtotal => Lines.Sum(line => line.Quantity * line.UnitPrice);

    public decimal TotalWeight => Lines.Sum(line => line.Quantity * line.Weight);

    public void SetQuantity(int productId, int quantity)
    {
        var line = Lines.First(candidate => candidate.ProductId == productId);
        line.Quantity = quantity;
    }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}
`),
    supportFile('Fakes.cs', `
public static class FakeCoupons
{
    public static decimal DiscountFor(string couponCode, decimal subtotal) => couponCode == "WELCOME500" ? 500m : 0m;

    public static bool IsValid(string couponCode, decimal subtotal) => couponCode == "WELCOME500" && subtotal >= 1000m;
}

public static class FakeShippingRates
{
    public static bool Supports(string shippingMethod) => shippingMethod == "standard" || shippingMethod == "express";

    public static decimal FeeFor(string shippingMethod, decimal weight) => (shippingMethod == "express" ? 800m : 400m) + weight * 100m;

    public static DateTime DeliveryDateFor(string shippingMethod) => SampleData.Today.AddDays(shippingMethod == "express" ? 1 : 3);

    public static List<string> OptionsFor(decimal weight) => weight > 10m ? new List<string> { "standard" } : new List<string> { "standard", "express" };
}

public static class SampleData
{
    public static readonly DateTime Today = new(2026, 11, 1);

    public static readonly OrderDraft Draft = new()
    {
        CouponCode = "WELCOME500",
        ShippingMethod = "standard",
        Lines = new List<OrderLine>
        {
            new OrderLine { ProductId = 7, Quantity = 1, UnitPrice = 1800m, Weight = 0.5m, Discounted = true },
            new OrderLine { ProductId = 8, Quantity = 1, UnitPrice = 950m, Weight = 0.3m },
        },
    };
}
`),
  ],
};
