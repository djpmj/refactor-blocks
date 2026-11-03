import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/** 中級12: 横流しするだけの OrderManager を呼び出し元へ戻して消す。受け取った値を Controller → Manager → Service へそのまま渡す。 */
export const intermediateMiddleManRuntime: StageRuntime = {
  entryMethodId: 'method-place-order',
  entryArguments: ['SampleData.Request'],
  support: [
    logFile,
    supportFile('Requests.cs', `
public class OrderItem
{
    public int ProductId;
    public int Quantity;
    public decimal UnitPrice;
    public decimal Weight;
    public string Currency;
}

public class Address
{
    public string Prefecture;
}

public class Customer
{
    public int Id;
}

public class OrderRequest
{
    public int CustomerId;
    public List<OrderItem> Items;
    public Address Address;
    public string Currency;

    public static OrderRequest Validate(OrderRequest request, Customer customer) => request;
}

public class CancelRequest
{
    public int OrderId;
    public string Reason;

    public static CancelRequest Validate(CancelRequest request, Order order) => request;
}

public class Order
{
    public Order()
    {
    }

    public Order(int id, int customerId, List<OrderItem> items, decimal total, string currency)
    {
        Id = id;
        CustomerId = customerId;
        Items = items;
        Total = total;
        Currency = currency;
    }

    public int Id { get; set; }

    public int CustomerId { get; set; }

    public List<OrderItem> Items { get; set; } = new();

    public decimal Total { get; set; }

    public string Currency { get; set; }

    public string Status { get; set; } = "Confirmed";

    public DateTimeOffset? ShippedAt { get; set; }

    public DateTimeOffset? CancelledAt { get; set; }

    public DateTimeOffset ConfirmedAt { get; set; }

    public decimal PaidAmount { get; set; }

    public string CustomerType { get; set; } = "Regular";

    public bool IsClosed { get; set; }

    public void MarkCancellationRequested(int refundId)
    {
        Console.WriteLine($"[注文] 注文 {Id} にキャンセル申請 {refundId} を記録しました");
    }
}

public class OrderResponse
{
    public OrderResponse(int id, decimal total)
    {
        Id = id;
        Total = total;
    }

    public int Id { get; }

    public string Status { get; set; }

    public int CustomerId { get; set; }

    public int ItemCount { get; set; }

    public decimal Total { get; set; }

    public string Currency { get; set; }

    public string Message { get; set; }
}

public class CancelResponse
{
    public CancelResponse(int orderId, decimal refundAmount)
    {
        OrderId = orderId;
        RefundAmount = refundAmount;
    }

    public int OrderId { get; }

    public string Status { get; set; }

    public decimal RefundAmount { get; set; }

    public string Message { get; set; }

    public DateTimeOffset Timestamp { get; set; }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}

public class InsufficientStockException : Exception
{
    public InsufficientStockException(int productId) : base($"商品 {productId} の在庫が足りません") { }
}
`),
    supportFile('Fakes.cs', `
public class Product
{
    public bool IsActive = true;
}

public class StockReservation
{
    public StockReservation(int productId, int quantity)
    {
        ProductId = productId;
        Quantity = quantity;
    }

    public int ProductId { get; }

    public int Quantity { get; }

    public int Id => 9001;

    public DateTimeOffset RequestedAt { get; set; }

    public int OrderId { get; set; }

    public int CustomerId { get; set; }

    public string Status { get; set; }
}

public class OrderQuote
{
    public decimal Subtotal { get; set; }

    public decimal Discount { get; set; }

    public decimal TaxableAmount { get; set; }

    public decimal Tax { get; set; }

    public decimal ShippingFee { get; set; }

    public decimal Total { get; set; }

    public string Currency { get; set; }

    public DateTimeOffset CalculatedAt { get; set; }
}

public class RefundPolicy
{
    public decimal RateFor(TimeSpan elapsed) => elapsed.TotalDays < 7 ? 1m : 0.5m;
}

public class Refund
{
    public Refund(int orderId, decimal amount)
    {
        OrderId = orderId;
        Amount = amount;
    }

    public int OrderId { get; }

    public decimal Amount { get; }

    public int Id => 7001;

    public DateTimeOffset RequestedAt { get; set; }
}

public static class FakeCustomers
{
    public static Customer Find(int customerId) => new() { Id = customerId };
}

public static class FakeProducts
{
    public static Product Find(int productId) => new();
}

public static class FakeStockStore
{
    public static int GetAvailable(int productId) => 50;

    public static void Reserve(StockReservation reservation)
    {
        Console.WriteLine($"[在庫] 商品 {reservation.ProductId} を {reservation.Quantity} 個引き当てました");
    }

    public static void Save(StockReservation reservation)
    {
        Console.WriteLine($"[DB] 予約 {reservation.Id} を保存しました");
    }
}

public static class FakeOrders
{
    public static Order Find(int orderId) => new() { Id = orderId, PaidAmount = 5000m, ConfirmedAt = SampleData.Now.AddDays(-2) };

    public static void Save(Order order)
    {
        Console.WriteLine($"[DB] 注文 {order.Id} を保存しました");
    }
}

public static class FakeRefundPolicies
{
    public static RefundPolicy Find(string customerType) => new();
}

public static class FakePayments
{
    public static void ValidateRefund(Refund refund)
    {
        Console.WriteLine($"[決済] 返金 {refund.Id} ({refund.Amount} 円) を確認しました");
    }
}

public static class FakeRefunds
{
    public static void Save(Refund refund)
    {
        Console.WriteLine($"[DB] 返金 {refund.Id} を保存しました");
    }
}

public static class ZoneResolver
{
    public static string Resolve(string prefecture) => prefecture == "東京都" ? "関東" : "その他";
}

public static class ShippingRates
{
    public static decimal Calculate(string zone, decimal weight) => zone == "関東" ? 500m + weight * 100m : 800m + weight * 150m;
}

public static class Discounts
{
    public static decimal Calculate(int customerId, decimal subtotal) => decimal.Round(subtotal * 0.05m, 0);
}

public static class TaxPolicy
{
    public static decimal RateFor(string prefecture) => 0.10m;
}

public static class SampleData
{
    public static readonly DateTimeOffset Now = new(2026, 11, 1, 9, 0, 0, TimeSpan.Zero);

    public static readonly OrderRequest Request = new()
    {
        CustomerId = 42,
        Address = new Address { Prefecture = "東京都" },
        Currency = "JPY",
        Items = new List<OrderItem>
        {
            new OrderItem { ProductId = 7, Quantity = 2, UnitPrice = 1800m, Weight = 0.5m, Currency = "JPY" },
            new OrderItem { ProductId = 8, Quantity = 1, UnitPrice = 950m, Weight = 0.3m, Currency = "JPY" },
        },
    };
}
`),
  ],
};
