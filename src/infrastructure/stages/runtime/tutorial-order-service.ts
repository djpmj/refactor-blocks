import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { mailFakesFile, mailMessageFile, supportFile, unitOfWorkFile } from './supportFiles';

/** チュートリアル2: 注文処理。在庫・DB・メールは、何をしたかを1行出す偽物にする。 */
export const tutorialOrderServiceRuntime: StageRuntime = {
  entryMethodId: 'method-place-order',
  entryArguments: ['SampleData.Items', '"P-100"', '2', 'SampleData.Order', 'CancellationToken.None'],
  support: [
    unitOfWorkFile,
    mailMessageFile,
    mailFakesFile,
    supportFile('Order.cs', `
public class OrderItem
{
    public int Quantity;
    public decimal UnitPrice;
    public bool IsValid = true;
}

public class Order
{
    public int Id;
    public string CustomerEmail;
    public bool IsReducedRate;
    public decimal Subtotal;
    public decimal TaxAmount;
    public decimal Total;
}

public static class TaxRates
{
    public const decimal Standard = 0.10m;
    public const decimal Reduced = 0.08m;
}
`),
    supportFile('Exceptions.cs', `
public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class InsufficientStockException : Exception
{
    public InsufficientStockException(string productId) : base($"在庫が足りません: {productId}") { }
}
`),
    supportFile('FakeInventory.cs', `
public static class FakeInventory
{
    public static Task<bool> IsAvailableAsync(string productId, int quantity)
    {
        Console.WriteLine($"[在庫] {productId} を {quantity} 個確認しました");
        return Task.FromResult(true);
    }

    public static Task ReserveAsync(string productId, int quantity)
    {
        Console.WriteLine($"[在庫] {productId} を {quantity} 個確保しました");
        return Task.CompletedTask;
    }
}
`),
    supportFile('FakeOrderRepository.cs', `
public static class FakeOrderRepository
{
    public static Task SaveAsync(Order order, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[DB] 注文 {order.Id} を保存しました (合計 {order.Total})");
        return Task.CompletedTask;
    }
}
`),
    supportFile('SampleData.cs', `
public static class SampleData
{
    public static readonly List<OrderItem> Items = new()
    {
        new OrderItem { Quantity = 2, UnitPrice = 1280m },
        new OrderItem { Quantity = 1, UnitPrice = 540m },
    };

    public static readonly Order Order = new() { Id = 1001, CustomerEmail = "taro@example.com", IsReducedRate = false };
}
`),
  ],
};
