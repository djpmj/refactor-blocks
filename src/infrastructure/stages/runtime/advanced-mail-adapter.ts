import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

export const advancedMailAdapterRuntime: StageRuntime = {
  entryMethodId: 'method-mail-confirm-order',
  entryArguments: ['SampleData.Order'],
  expectedBuildFailures: ['04', '05', '06', '07'],
  support: [
    logFile,
    supportFile('Mail.cs', `
public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}
public class SendGridException : Exception
{
    public SendGridException(string message) : base(message) { }
}
public class Order
{
    public int Id = 1001;
    public string CustomerEmail = "customer@example.com";
    public string CustomerName = "山田";
    public decimal Total = 5400m;
    public List<string> Items = new() { "ノート" };
    public string Status = "New";
}
public class Member
{
    public Member(string email, string name) { Email = email; Name = name; }
    public int Id = 2001;
    public string Email;
    public string Name;
}
public class EmailAddress
{
    public EmailAddress(string address) { Address = address; }
    public string Address;
}
public class SendGridMessage
{
    public EmailAddress From = new("");
    public string Subject = "";
    public void AddTo(EmailAddress address) => Console.WriteLine($"[宛先] {address.Address}");
    public void AddContent(string type, string body) => Console.WriteLine($"[本文] {type}: {body}");
    public string ToJson() => $"{From.Address}: {Subject}";
}
public class SendGridResponse
{
    public int StatusCode = 202;
    public string Body = "";
}
public static class FakeSendGridApi
{
    public static SendGridResponse Post(string path, string payload)
    {
        Console.WriteLine($"[SendGrid] {path}: {payload}");
        return new SendGridResponse();
    }
}
public static class FakeOrderRepository
{
    public static void Save(Order order) => Console.WriteLine($"[注文] {order.Id} を保存しました");
}
public static class FakeMemberRepository
{
    public static void Save(Member member) => Console.WriteLine($"[会員] {member.Email} を保存しました");
    public static Member FindByEmail(string email) => new(email, "山田");
}
public static class FakeResetTokenStore
{
    public static void Save(int id, string token) => Console.WriteLine($"[再設定] {id}: {token}");
}
public static class SampleData
{
    public static readonly Order Order = new();
}
`),
  ],
};
