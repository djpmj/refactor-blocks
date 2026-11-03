import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { bindingDemoFile, logFile, supportFile } from './supportFiles';

/**
 * 上級2: 決済ゲートウェイをインターフェース(PaymentGateway)越しに呼ぶ。
 * 初期状態では StripeGateway・PaypalGateway がまだ PaymentGateway を実装していないので、PaymentService.checkout は実行できない。
 * そのため入口は StripeGateway.charge にする(実装を宣言した後も同じ出力になる)。実装が2つあるので、注入するのは StripeGateway と決める。
 * 実装を宣言した手順では、bindings で選んだ StripeGateway を PaymentGateway 越しに実行し、PaymentService.checkout も通して `[bindings]` の行で見せる。
 * 決済 API・監査ログは、何をしたかを1行出す偽物。
 */
export const advancedPaymentGatewayInterfaceRuntime: StageRuntime = {
  entryMethodId: 'method-charge-stripe',
  entryArguments: ['1500m', '"tok_sample"'],
  bindings: { PaymentGateway: 'StripeGateway' },
  bindingDemos: {
    PaymentGateway: [
      'BindingDemo.Run("charge", {0}, () => {0}.charge(1500m, "tok_sample"));',
      'BindingDemo.Run("PaymentService.checkout 経由", {0}, () => paymentService.checkout(SampleData.Items, "4111111111111111", "tok_sample"));',
    ].join('\n'),
  },
  support: [
    logFile,
    bindingDemoFile,
    supportFile('Payment.cs', `
public class OrderItem
{
    public int Quantity;
    public decimal UnitPrice;
    public bool IsValid = true;
}

public class PaymentResult
{
    public bool Succeeded;
    public string ErrorMessage;
    public string ChargeId;
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class PaymentException : Exception
{
    public PaymentException(string message) : base(message) { }
}

public static class FakeAuditLog
{
    public static void Write(string action) => Console.WriteLine($"[AUDIT] {action} を記録しました");
}

public static class FakeStripeClient
{
    public static PaymentResult CreateCharge(decimal amount, string paymentToken)
    {
        Console.WriteLine($"[STRIPE] {amount} 円の決済を受け付けました");
        return new PaymentResult { Succeeded = true, ChargeId = "ch_001" };
    }

    public static void Configure(string apiKey) => Console.WriteLine("[STRIPE] APIキーを設定しました");
}

public static class FakePaypalClient
{
    public static PaymentResult CreateOrder(decimal amount, string paymentToken)
    {
        Console.WriteLine($"[PAYPAL] {amount} 円の決済を受け付けました");
        return new PaymentResult { Succeeded = true, ChargeId = "ord_001" };
    }

    public static void Configure(string clientSecret) => Console.WriteLine("[PAYPAL] client secret を設定しました");
}

public static class SampleData
{
    public static readonly List<OrderItem> Items = new()
    {
        new OrderItem { Quantity = 1, UnitPrice = 1000m },
        new OrderItem { Quantity = 2, UnitPrice = 250m },
    };
}
`),
  ],
};
