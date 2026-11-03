import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, mailMessageFile, supportFile } from './supportFiles';

/**
 * 中級3: NotificationService が TemplateEngine の private メソッドを呼んでいる。
 * 越境する private はこのステージで学ぶ問題そのものなので、初期状態と、直る前の手順(initial・01・02)はビルドに失敗してよい。
 */
export const intermediateMisplacedPrivateRuntime: StageRuntime = {
  entryMethodId: 'method-notify-shipment',
  entryArguments: ['SampleData.Shipment', 'SampleData.Template'],
  expectedBuildFailures: ['initial', '01', '02'],
  support: [
    logFile,
    mailMessageFile,
    supportFile('Notification.cs', `
public class Shipment
{
    public int CustomerId;
    public string TrackingNumber;
    public string Status;
}

public class TemplateInput
{
    public string Template;
    public string TrackingNumber;
}

public static class RecipientDirectory
{
    public static string Find(int customerId) => $"customer{customerId}@example.com";
}

public static class FakeMailer
{
    public static void Send(MailMessage message)
    {
        Console.WriteLine($"[MAIL] {message.To} 宛に「{message.Subject}」を送信しました ({message.Id})");
    }
}

public static class FakeMailAuditLog
{
    public static void RecordSent(string messageId)
    {
        Console.WriteLine($"[AUDIT] メール {messageId} の送信を記録しました");
    }
}

public static class SampleData
{
    public static readonly Shipment Shipment = new() { CustomerId = 42, TrackingNumber = "TRK-0001", Status = "配達完了" };

    public static readonly TemplateInput Template = new() { Template = "追跡番号 {trackingNumber} の荷物は {body}", TrackingNumber = "TRK-0001" };
}
`),
  ],
};
