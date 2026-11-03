import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級1: 通知クラスの共通処理(送信ログ)を基底クラス NotifierBase へ集める。
 * 入口は EmailNotifier.notifyByEmail。SMS 側は実行しないが、同じ形でビルドできる。
 * メール・SMS の送信と監査ログは、何をしたかを1行出す偽物。
 */
export const advancedNotifierHierarchyRuntime: StageRuntime = {
  entryMethodId: 'method-notify-email',
  // 05: 統合したメソッドが private のまま EmailNotifier に残り、SmsNotifier から呼ぶとビルドに失敗する(06 で基底クラスへ移す)
  expectedBuildFailures: ['05'],
  entryArguments: ['SampleData.Recipient', '"https://example.com/confirm?token=abc"', '"RefactorBlocks運営チーム"'],
  support: [
    logFile,
    supportFile('Notification.cs', `
public class Recipient
{
    public string Name;
    public string Email;
    public string PhoneNumber;
}

public class MailMessage
{
    public MailMessage(string to, string subject, string body)
    {
        To = to;
        Subject = subject;
        Body = body;
    }

    public string Id => "MSG-001";

    public string To { get; }

    public string Subject { get; }

    public string Body { get; }
}

public class SmsMessage
{
    public SmsMessage(string phoneNumber, string body)
    {
        PhoneNumber = phoneNumber;
        Body = body;
    }

    public string Id => "SMS-001";

    public string PhoneNumber { get; }

    public string Body { get; }
}

public static class FakeAuditLog
{
    public static void Write(string recipientName) => Console.WriteLine($"[AUDIT] {recipientName} への通知を記録しました");
}

public static class FakeMailGateway
{
    public static void Send(MailMessage message) => Console.WriteLine($"[MAIL] {message.To} 宛に「{message.Subject}」を送信しました ({message.Id})");
}

public static class FakeMailAudit
{
    public static void RecordSent(string messageId) => Console.WriteLine($"[AUDIT] メール {messageId} の送信を記録しました");
}

public static class FakeSmsClient
{
    public static void Send(SmsMessage message) => Console.WriteLine($"[SMS] {message.PhoneNumber} 宛に送信しました ({message.Id})");
}

public static class FakeSmsAudit
{
    public static void RecordSent(string messageId) => Console.WriteLine($"[AUDIT] SMS {messageId} の送信を記録しました");
}

public static class SampleData
{
    public static readonly Recipient Recipient = new() { Name = "山田太郎", Email = "taro@example.com", PhoneNumber = "090-0000-0000" };
}
`),
  ],
};
