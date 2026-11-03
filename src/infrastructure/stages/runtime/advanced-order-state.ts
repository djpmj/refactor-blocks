import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { bindingDemoFile, logFile, supportFile } from './supportFiles';

/**
 * 上級9: 注文の状態ごとの分岐を、状態のクラス(UnpaidState・PaidState・ShippedState)へ組み替える(State)。
 * 入口は Order.pay。初期状態では OrderState の実装が無く OrderController は動かせないので、
 * 状態ごとの処理を順に呼ぶ Order.pay を入口にする(組み替えたあとも同じ出力になる)。
 * 注文のデータは、ゲームのクラス Order とは別の補助のクラス OrderData に持たせ、メソッドの引数で渡す。
 * 状態の分岐は「いまの状態」を見て、次の状態は NextStatus に書くだけにする(順に呼んでも、先の分岐が後の分岐の判定を変えない)。
 * 決済・倉庫・在庫・DB は、何をしたかを1行出す偽物。OrderController が注入する OrderState は、未払い用の UnpaidState と決める。
 */
export const advancedOrderStateRuntime: StageRuntime = {
  entryMethodId: 'method-order-pay',
  entryArguments: ['SampleData.Order'],
  bindings: { OrderState: 'UnpaidState' },
  // bindings で選んだ状態(未払い)が支払い・取り消しを受けたときの出力(発送は未払いだと例外になる仕様なので見せない。例外は握りつぶさないため)を、`[bindings]` の行で見せる(状態ごとに違う)
  bindingDemos: {
    OrderState: [
      'BindingDemo.Run("handlePay", {0}, () => {0}.handlePay(SampleData.NewOrder()));',
      'BindingDemo.Run("handleCancel", {0}, () => {0}.handleCancel(SampleData.NewOrder()));',
    ].join('\n'),
  },
  support: [
    logFile,
    bindingDemoFile,
    supportFile('OrderData.cs', `
public enum OrderStatus
{
    Unpaid,
    Paid,
    Shipped,
    Canceled,
}

public class OrderData
{
    public int Id;
    public decimal Total;
    public string Address = "";
    public List<string> Items = new();
    public OrderStatus Status;
    public OrderStatus NextStatus;
    public string TrackingNumber = "";
}

public class PaymentResult
{
    public bool Succeeded;
    public string ErrorMessage = "";
}

public class Shipment
{
    public string TrackingNumber = "";
}

public class PaymentException : Exception
{
    public PaymentException(string message) : base(message) { }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class NotFoundException : Exception
{
    public NotFoundException(string id) : base(id) { }
}

public static class FakePayment
{
    public static PaymentResult Charge(int orderId, decimal total)
    {
        Console.WriteLine($"[決済] 注文 {orderId} を {total} 円で決済しました");
        return new PaymentResult { Succeeded = true };
    }

    public static void Refund(int orderId, decimal total) => Console.WriteLine($"[決済] 注文 {orderId} に {total} 円を返金しました");
}

public static class FakeWarehouse
{
    public static Shipment RequestShipment(int orderId, string address)
    {
        Console.WriteLine($"[倉庫] 注文 {orderId} を {address} へ出荷します");
        return new Shipment { TrackingNumber = "TRK-0001" };
    }
}

public static class FakeInventory
{
    public static void Release(List<string> items) => Console.WriteLine($"[在庫] {items.Count} 点を戻しました");
}

public static class FakeOrderRepository
{
    public static OrderData Find(string orderId) => SampleData.Order;

    public static void ArchiveCanceled(int orderId) => Console.WriteLine($"[DB] 注文 {orderId} を取り消し履歴へ移しました");
}

public static class SampleData
{
    public static OrderData NewOrder() => new()
    {
        Id = 2001,
        Total = 5400m,
        Address = "東京都千代田区1-1",
        Items = new List<string> { "ノート", "ペン" },
        Status = OrderStatus.Unpaid,
        NextStatus = OrderStatus.Unpaid,
    };

    public static readonly OrderData Order = new()
    {
        Id = 1001,
        Total = 5400m,
        Address = "東京都千代田区1-1",
        Items = new List<string> { "ノート", "ペン" },
        Status = OrderStatus.Unpaid,
        NextStatus = OrderStatus.Unpaid,
    };
}
`),
  ],
};
