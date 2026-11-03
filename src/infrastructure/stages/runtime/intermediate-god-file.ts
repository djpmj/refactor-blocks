import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/** 中級2: カート・配送・ポイントが1ファイルに同居。送料の計算とポイントの付与は、補助コードの偽物を使う。 */
export const intermediateGodFileRuntime: StageRuntime = {
  entryMethodId: 'method-checkout-cart',
  entryArguments: ['SampleData.Items', '"東京都千代田区"', '2.5m', '42'],
  support: [
    logFile,
    supportFile('Cart.cs', `
public class CartItem
{
    public int Quantity;
    public decimal UnitPrice;
    public bool IsValid = true;
}

public class Order
{
    public Order(List<CartItem> items, decimal total, string address, decimal weight)
    {
        Items = items;
        Total = total;
        Address = address;
        Weight = weight;
    }

    public List<CartItem> Items { get; }

    public decimal Total { get; set; }

    public string Address { get; }

    public decimal Weight { get; }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}
`),
    supportFile('Fakes.cs', `
public static class ZoneResolver
{
    public static string Resolve(string address) => address.StartsWith("東京") ? "関東" : "その他";
}

public static class ShippingRates
{
    public static decimal Calculate(string zone, decimal weight)
    {
        Console.WriteLine($"[配送] {zone} 向けの送料を計算しました");
        return zone == "関東" ? 500m + weight * 100m : 800m + weight * 150m;
    }
}

public static class DeliveryCalendar
{
    public static DateTime NextAvailableDate(string zone, DateTime requestedDate) => requestedDate.AddDays(zone == "関東" ? 1 : 3);
}

public static class TrackingClient
{
    public static string GetStatus(string trackingNumber) => "配送中";
}

public static class PointLedger
{
    public static void Add(int customerId, int points)
    {
        Console.WriteLine($"[ポイント] 顧客 {customerId} に {points} ポイントを加算しました");
    }

    public static int GetBalance(int customerId) => 120;

    public static int ExpireBefore(int customerId, DateTime expiredBefore) => 0;
}

public static class SampleData
{
    public static readonly DateTime Today = new(2026, 11, 1);

    public static readonly List<CartItem> Items = new()
    {
        new CartItem { Quantity = 2, UnitPrice = 1500m },
        new CartItem { Quantity = 1, UnitPrice = 4200m },
    };
}
`),
  ],
};
