import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { bindingDemoFile, logFile, supportFile } from './supportFiles';

/**
 * 上級3: 会員ランクごとの割引を Strategy(DiscountStrategy を実装した3クラス)に分ける。
 * 3つの割引は「自分のランクのときだけ計算し、それ以外は手前の合計をそのまま返す」形にそろえる(同じ引数・戻り値で、インターフェースを実装できる)。
 * DiscountService は3つの具象クラスを順に呼ぶ(入口の出力は割引を分ける前と同じ)。
 * そのうえで、bindings で選んだ実装(プレミアム割引)をインターフェース DiscountStrategy 越しに実行し、どの割引がいくら引いたかを `[bindings]` の行で見せる。
 */
export const advancedDiscountStrategyRuntime: StageRuntime = {
  entryMethodId: 'method-calculate-discount',
  entryArguments: ['SampleData.Order'],
  bindings: { DiscountStrategy: 'PremiumDiscount' },
  bindingDemos: { DiscountStrategy: 'BindingDemo.Run("calculate", {0}, () => {0}.calculate(5400m, MemberRank.Premium, 5400m));' },
  support: [
    logFile,
    bindingDemoFile,
    supportFile('Pricing.cs', `
public enum MemberRank
{
    Regular,
    Premium,
    Vip,
}

public class OrderItem
{
    public int Quantity;
    public decimal UnitPrice;
}

public class Order
{
    public List<OrderItem> Items;
    public MemberRank MemberRank;
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public static class SampleData
{
    public static readonly Order Order = new()
    {
        MemberRank = MemberRank.Premium,
        Items = new List<OrderItem>
        {
            new OrderItem { Quantity = 3, UnitPrice = 1000m },
            new OrderItem { Quantity = 2, UnitPrice = 450m },
        },
    };
}
`),
  ],
};
