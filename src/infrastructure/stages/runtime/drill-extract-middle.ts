import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { supportFile } from './supportFiles';

/** ドリル2: 請求書の発行。注文の読み込みと請求書の保存は、何をしたかを1行出す偽物にする。 */
export const drillExtractMiddleRuntime: StageRuntime = {
  entryMethodId: 'method-drill-issue',
  entryArguments: ['1001'],
  support: [
    supportFile('Order.cs', `
public class OrderItem
{
    public decimal Price;
    public int Quantity;
}

public class Coupon
{
    public decimal Discount;
}

public class Order
{
    public int Id;
    public bool IsReducedRate;
    public List<OrderItem> Items = new();
    public Coupon Coupon;
}

public class Invoice
{
    public Invoice(int orderId, decimal total)
    {
        OrderId = orderId;
        Total = total;
    }

    public int OrderId { get; }

    public decimal Total { get; }
}

public class OrderNotFoundException : Exception
{
    public OrderNotFoundException(int orderId) : base($"注文が見つかりません: {orderId}") { }
}
`),
    supportFile('Fakes.cs', `
public static class FakeOrderRepository
{
    public static Task<Order> FindAsync(int orderId)
    {
        Console.WriteLine($"[DB] 注文 {orderId} を読み込みました");
        var order = new Order { Id = orderId, IsReducedRate = false, Coupon = new Coupon { Discount = 300m } };
        order.Items.Add(new OrderItem { Price = 1200m, Quantity = 2 });
        order.Items.Add(new OrderItem { Price = 800m, Quantity = 1 });
        return Task.FromResult(order);
    }
}

public static class FakeInvoiceRepository
{
    public static Task SaveAsync(Invoice invoice)
    {
        Console.WriteLine($"[DB] 注文 {invoice.OrderId} の請求書(合計 {invoice.Total})を保存しました");
        return Task.CompletedTask;
    }
}
`),
  ],
};
