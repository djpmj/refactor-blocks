import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, mailFakesFile, mailMessageFile, supportFile, unitOfWorkFile } from './supportFiles';

/** 初級1: ユーザー登録。DB・メール・HTTPの応答は、何をしたかを1行出す偽物にする。 */
export const beginnerUserControllerRuntime: StageRuntime = {
  entryMethodId: 'method-register-user',
  entryArguments: ['new RegisterInput { Name = "田中太郎", Email = "taro@example.com" }', 'CancellationToken.None'],
  support: [
    logFile,
    unitOfWorkFile,
    mailMessageFile,
    mailFakesFile,
    supportFile('User.cs', `
public class RegisterInput
{
    public string Name;
    public string Email;
}

public class User
{
    private static int nextId = 1;

    public int Id { get; private set; }

    public string Name { get; private set; }

    public string Email { get; private set; }

    public static User Create(string name, string email)
    {
        return new User { Id = nextId++, Name = name, Email = email };
    }
}

public class ApiResponse
{
    public ApiResponse(int userId, string name, string email)
    {
        Summary = $"{userId} {name} <{email}>";
    }

    public ApiResponse(int statusCode, string message)
    {
        Summary = $"{statusCode} {message}";
    }

    public string Summary { get; }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public static class EmailAddress
{
    public static bool TryParse(string text, out string address)
    {
        address = text;
        return text.Contains('@');
    }
}
`),
    supportFile('Fakes.cs', `
public static class FakeUserStore
{
    public static Task SaveAsync(User user, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[DB] ユーザー {user.Id} ({user.Name}) を保存しました");
        return Task.CompletedTask;
    }

    public static Task DeleteAsync(int userId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[DB] ユーザー {userId} を削除しました");
        return Task.CompletedTask;
    }
}

public static class Results
{
    public static void Created(string path, ApiResponse response)
    {
        Console.WriteLine($"[HTTP] 201 Created {path} {response.Summary}");
    }

    public static void Json(ApiResponse response, int statusCode)
    {
        Console.WriteLine($"[HTTP] {statusCode} {response.Summary}");
    }
}
`),
  ],
};
