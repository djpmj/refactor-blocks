import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, mailMessageFile, supportFile } from './supportFiles';

/**
 * 中級6: BillingService が Subscription のフィールドばかり読む。
 * フィールドに初期値を書けないので、決済・メールの偽物は「何もしなくても使える struct」にし、
 * Subscription の初期値は補助コードの partial クラスのコンストラクタで与える。
 * 模範解答の途中(02)は、移動したメソッドが BillingService の private フィールド trialDays を読むのでビルドに失敗する。
 */
export const intermediateFeatureEnvyRuntime: StageRuntime = {
  entryMethodId: 'method-renew-subscription',
  entryArguments: ['"billing@example.com"', '"tok_456"'],
  expectedBuildFailures: ['02'],
  support: [
    logFile,
    mailMessageFile,
    supportFile('Billing.cs', `
public class PaymentResult
{
    public bool Succeeded;
    public string ErrorMessage;
}

public class PaymentException : Exception
{
    public PaymentException(string message) : base(message) { }
}

public struct PaymentGateway
{
    public PaymentResult Charge(decimal amount, string token)
    {
        Console.WriteLine($"[決済] {token} に {amount} 円を請求しました");
        return new PaymentResult { Succeeded = true };
    }
}

public struct Mailer
{
    public void Send(MailMessage message)
    {
        Console.WriteLine($"[MAIL] {message.To} 宛に「{message.Subject}」を送信しました ({message.Id})");
    }
}

public static class SampleData
{
    public static readonly DateTime Today = new(2026, 11, 1);
}

public partial class Subscription
{
    public Subscription()
    {
        status = "Active";
        startedAt = new DateTime(2026, 10, 1);
        seats = 5;
        unitPrice = 1200m;
    }
}
`),
  ],
};
