import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, mailMessageFile, supportFile, unitOfWorkFile } from './supportFiles';

/** ドリル1: 会員登録。保存とメール送信は、何をしたかを1行出す偽物にする。 */
export const drillExtractTailRuntime: StageRuntime = {
  entryMethodId: 'method-drill-register',
  entryArguments: ['"田中太郎"', '"taro@example.com"'],
  support: [
    logFile,
    unitOfWorkFile,
    mailMessageFile,
    supportFile('Member.cs', `
public class Member
{
    public Member(string name, string email)
    {
        Name = name;
        Email = email;
    }

    public string Name { get; }

    public string Email { get; }
}
`),
    supportFile('FakeMemberRepository.cs', `
public static class FakeMemberRepository
{
    public static Task SaveAsync(Member member)
    {
        Console.WriteLine($"[DB] 会員 {member.Name} を保存しました");
        return Task.CompletedTask;
    }
}

public static class FakeMailGateway
{
    public static Task SendAsync(MailMessage message)
    {
        Console.WriteLine($"[MAIL] {message.To} 宛に「{message.Subject}」を送信しました ({message.Id})");
        return Task.CompletedTask;
    }
}

public static class FakeMailLog
{
    public static Task RecordAsync(string email)
    {
        Console.WriteLine($"[DB] {email} へのメール送信を記録しました");
        return Task.CompletedTask;
    }
}
`),
  ],
};
