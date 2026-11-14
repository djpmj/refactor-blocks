import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

export const advancedApprovalChainRuntime: StageRuntime = {
  entryMethodId: 'method-review-claim',
  entryArguments: ['SampleData.Claim', 'new ReviewResult()'],
  bindings: { ApprovalRule: 'AmountLimitRule' },
  support: [logFile, supportFile('Expense.cs', `
public class ExpenseClaim
{
    public string Id = "C-1001";
    public string Category = "交通費";
    public decimal Amount = 60000m;
    public List<string> ReceiptIds = new() { "R-1001" };
    public bool ManagerApproved;
}

public class ReviewResult
{
    public string Status = "未審査";
    public bool IsDecided;
    public void Reject(string reason) { Status = $"却下: {reason}"; IsDecided = true; Console.WriteLine(Status); }
    public void SendBack(string reason) { Status = $"差し戻し: {reason}"; IsDecided = true; Console.WriteLine(Status); }
    public void Hold(string reason) { Status = $"承認待ち: {reason}"; IsDecided = true; Console.WriteLine(Status); }
    public void Approve() { Status = "承認"; IsDecided = true; Console.WriteLine(Status); }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public static class FakeClaimRepository
{
    public static ExpenseClaim Find(string id) { Console.WriteLine($"[DB] 申請 {id} を読み込みました"); return SampleData.Claim; }
    public static List<string> ClaimedReceiptIds() { Console.WriteLine("[DB] 使用済み領収書を確認しました"); return new(); }
    public static void SaveResult(string id, string status) => Console.WriteLine($"[DB] 申請 {id} の結果を保存: {status}");
}

public static class SampleData
{
    public static readonly ExpenseClaim Claim = new();
}
`) ],
};
