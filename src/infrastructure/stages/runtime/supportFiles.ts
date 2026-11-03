import type { StageRuntime } from '../../../domain/stage/StageRuntime';

type SupportFile = StageRuntime['support'][number];

/** 補助コードの1ファイル。プロジェクトの名前空間(RefactorBlocks)を頭に付ける。 */
export function supportFile(path: string, body: string): SupportFile {
  return { path, code: `namespace RefactorBlocks;\n\n${body.trim()}\n` };
}

/** 実行の流れを目で追うための、コンソールに1行出すログ。 */
export const logFile = supportFile('Log.cs', `
public static class Log
{
    public static void Debug(string message) => Console.WriteLine($"[LOG] {message}");

    public static void Info(string message) => Console.WriteLine($"[LOG] {message}");
}
`);

/** DBのコミットの偽物。 */
export const unitOfWorkFile = supportFile('FakeUnitOfWork.cs', `
public static class FakeUnitOfWork
{
    public static Task CommitAsync(CancellationToken cancellationToken = default)
    {
        Console.WriteLine("[DB] コミットしました");
        return Task.CompletedTask;
    }
}
`);

/** メールの本文・添付(System.Net.Mail の代わり。.NET 標準だけで動くようにする)。 */
export const mailMessageFile = supportFile('MailMessage.cs', `
public class Attachment
{
    public Attachment(Stream content, string name, string mediaType)
    {
        Name = name;
    }

    public string Name { get; }
}

public class MailMessage
{
    private static int nextId = 1;

    public MailMessage(string to, string subject, string body)
    {
        To = to;
        Subject = subject;
        Body = body;
        Id = $"MSG-{nextId++:000}";
    }

    public string Id { get; }

    public string To { get; }

    public string Subject { get; }

    public string Body { get; }

    public List<Attachment> Attachments { get; } = new();
}
`);

/** メール送信と送信記録の偽物。 */
export const mailFakesFile = supportFile('FakeMail.cs', `
public static class FakeMailGateway
{
    public static Task SendAsync(MailMessage message, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[MAIL] {message.To} 宛に「{message.Subject}」を送信しました ({message.Id})");
        return Task.CompletedTask;
    }
}

public static class FakeMailAuditLog
{
    public static Task RecordSentAsync(string messageId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[AUDIT] メール {messageId} の送信を記録しました");
        return Task.CompletedTask;
    }
}
`);

/**
 * bindings で選んだ実装を、インターフェース越しに実行して見せる(runtime.bindingDemos から呼ぶ)。
 * 実装が出した出力と、どの実装だったかを、各行に `[bindings] ` を付けて出す。例外は握りつぶさない(投げられたらそのままプログラムが異常終了し、検証が NG になる)。
 */
export const bindingDemoFile = supportFile('BindingDemo.cs', `
public static class BindingDemo
{
    public static void Run(string operation, object bound, Action action)
    {
        var original = Console.Out;
        var captured = new StringWriter();
        Console.SetOut(captured);
        try
        {
            action();
        }
        finally
        {
            Console.SetOut(original);
        }
        Console.WriteLine($"[bindings] {bound.GetType().Name}.{operation}");
        foreach (var line in captured.ToString().Split(new[] { '\\r', '\\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            Console.WriteLine($"[bindings]   {line}");
        }
    }
}
`);
