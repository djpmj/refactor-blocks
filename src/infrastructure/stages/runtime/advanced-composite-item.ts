// ponytail: 子要素ごとに実装を選ぶ(インスタンスの多態)はコード生成の注入(1型1実装)で表せないので、入口は単品にしてセットの再帰は実行しない。インスタンス単位の注入を表せるようになったら GiftSet を入口にする
import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級12: 単品とセットの型分岐を、2つのクラス(SingleItem・BundleItem)へ組み替える(Composite)。
 * 入口は CartService.priceItem。初期状態では CatalogItem に実装が無く注入は null になるため、セットでなく単品を入口にする
 * (組み替えたあとも同じ出力になる)。商品のデータは、ゲームのクラスとは別の補助のクラス ItemData に持たせ、引数で渡す。
 */
export const advancedCompositeItemRuntime: StageRuntime = {
  entryMethodId: 'method-cart-price-item',
  entryArguments: ['SampleData.Pen', 'new PriceQuote()'],
  support: [
    logFile,
    supportFile('CatalogData.cs', `
public abstract class ItemData
{
    public string Name = "";
}

public class SingleData : ItemData
{
    public decimal UnitPrice;
    public int Quantity;
}

public class BundleData : ItemData
{
    public List<ItemData> Children = new();
    public decimal DiscountRate;
}

public class PriceQuote
{
    public decimal Amount;
}

public static class SampleData
{
    public static readonly SingleData Pen = new() { Name = "ペン", UnitPrice = 120m, Quantity = 3 };

    public static readonly BundleData GiftSet = new()
    {
        Name = "ギフトセット",
        DiscountRate = 0.1m,
        Children = new List<ItemData>
        {
            new SingleData { Name = "ノート", UnitPrice = 200m, Quantity = 2 },
            new BundleData
            {
                Name = "文具セット",
                DiscountRate = 0.05m,
                Children = new List<ItemData> { new SingleData { Name = "ペン", UnitPrice = 120m, Quantity = 3 } },
            },
        },
    };
}
`),
  ],
};
