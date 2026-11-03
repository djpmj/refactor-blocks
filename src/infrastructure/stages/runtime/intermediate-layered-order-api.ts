import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/** 中級11: OrderController を Controller → Service → Repository の一方通行に分ける。DB・在庫は何をしたかを1行出す偽物。 */
export const intermediateLayeredOrderApiRuntime: StageRuntime = {
  entryMethodId: 'method-place-order',
  entryArguments: ['42', 'SampleData.Items', '7', '2', '"東京都千代田区"', '1.5m'],
  support: [
    logFile,
    supportFile('Orders.cs', `
public class OrderItem
{
    public int Quantity;
    public decimal UnitPrice;
}

public class Order
{
    public Order(List<OrderItem> items, decimal total)
    {
        Items = items;
        Total = total;
    }

    public int Id => 1001;

    public List<OrderItem> Items { get; }

    public decimal Total { get; }
}

public class CancelEntity
{
    public CancelEntity(int orderId)
    {
        OrderId = orderId;
    }

    public int OrderId { get; }

    public decimal RefundAmount { get; private set; }

    public void Cancel(decimal refundAmount)
    {
        RefundAmount = refundAmount;
    }
}

public class ApiResponse
{
    public ApiResponse(int statusCode, string message)
    {
        StatusCode = statusCode;
        Message = message;
    }

    public int StatusCode { get; }

    public string Message { get; }
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
    public static decimal Calculate(string zone, decimal weight) => zone == "関東" ? 500m + weight * 100m : 800m + weight * 150m;
}

public static class FakeInventory
{
    public static void Reserve(int productId, int quantity)
    {
        Console.WriteLine($"[在庫] 商品 {productId} を {quantity} 個引き当てました");
    }

    public static void Restock(int orderId)
    {
        Console.WriteLine($"[在庫] 注文 {orderId} の在庫を戻しました");
    }
}

public static class FakeRepository
{
    public static void Save(Order order)
    {
        Console.WriteLine($"[DB] 注文 {order.Id} を保存しました");
    }

    public static void SaveCancellation(CancelEntity entity)
    {
        Console.WriteLine($"[DB] 注文 {entity.OrderId} のキャンセルを保存しました");
    }
}

public static class FakeUnitOfWork
{
    public static void Commit()
    {
        Console.WriteLine("[DB] コミットしました");
    }
}

public static class SampleData
{
    public static readonly List<OrderItem> Items = new()
    {
        new OrderItem { Quantity = 2, UnitPrice = 1800m },
        new OrderItem { Quantity = 1, UnitPrice = 950m },
    };
}
`),
  ],
};
