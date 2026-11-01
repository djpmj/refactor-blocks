import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { supportFile, unitOfWorkFile } from './supportFiles';

/** ドリル3: 注文の確定。送料の計算(calculateShippingFee)は純粋な計算なので偽物を使わない。 */
export const drillMoveMethodRuntime: StageRuntime = {
  entryMethodId: 'method-drill-place',
  entryArguments: ['SampleData.Order'],
  support: [
    unitOfWorkFile,
    supportFile('Order.cs', `
public class Order
{
    public int Id;
    public List<string> Items = new();

    public void Validate()
    {
        Console.WriteLine($"[検証] 注文 {Id} を確認しました");
    }
}

public class InvalidOrderException : Exception
{
    public InvalidOrderException() : base("注文が不正です") { }
}
`),
    supportFile('FakeOrderRepository.cs', `
public static class FakeOrderRepository
{
    public static Task SaveAsync(Order order)
    {
        Console.WriteLine($"[DB] 注文 {order.Id} を保存しました");
        return Task.CompletedTask;
    }
}
`),
    supportFile('SampleData.cs', `
public static class SampleData
{
    public static readonly Order Order = new() { Id = 1001, Items = { "りんご", "みかん" } };
}
`),
  ],
};
