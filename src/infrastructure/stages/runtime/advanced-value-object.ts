import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級7: 金額(amount・currency)を Expense から Money へ移す(値オブジェクト)。
 * 入口は ExpenseApplicationService.submitExpense。承認・精算のサービスは実行しないが、同じ形でビルドできる。
 * フィールドに初期値を書けず、Money はゲームの中で後から作られるので、Expense と Money の初期値は
 * 「名前が合うフィールドだけに入れる」反射の補助(SampleValues)で与える。Money の partial は初期状態でもビルドできる。
 * 承認依頼・DB・銀行は、何をしたかを1行出す偽物。
 */
export const advancedValueObjectRuntime: StageRuntime = {
  entryMethodId: 'method-submit-expense',
  // 07〜11: 統合した validate・add・format が private のまま片方のサービスに残り、もう一方のサービスから呼ぶとビルドに失敗する(CS0122)。
  // Money へフィールドとメソッドを移す 12 以降は、移したメソッドが public になりビルドできる
  expectedBuildFailures: ['07', '08', '09', '10', '11'],
  entryArguments: ['new DateTime(2020, 1, 1)', '"receipt-001.pdf"', '"boss-1"', '"EXP-1001"'],
  support: [
    logFile,
    supportFile('Expense.cs', `
public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public static class SupportedCurrencies
{
    public static bool Contains(string currency) => currency is "JPY" or "USD";
}

public static class CurrencyDigits
{
    public static int For(string currency) => currency == "JPY" ? 0 : 2;
}

public class ApprovalRequest
{
    public ApprovalRequest(string supervisorId, string expenseId, string formattedAmount)
    {
        SupervisorId = supervisorId;
        ExpenseId = expenseId;
        FormattedAmount = formattedAmount;
    }

    public string SupervisorId { get; }

    public string ExpenseId { get; }

    public string FormattedAmount { get; }
}

public class BankTransfer
{
    public BankTransfer(string bankAccount, string formattedAmount)
    {
        BankAccount = bankAccount;
        FormattedAmount = formattedAmount;
    }

    public string BankAccount { get; }

    public string FormattedAmount { get; }
}

public static class FakeApproval
{
    public static void Request(ApprovalRequest approval) => Console.WriteLine($"[承認] {approval.SupervisorId} に {approval.ExpenseId} ({approval.FormattedAmount}) の承認を依頼しました");
}

public static class FakeExpenseRepository
{
    public static List<string> FindByDepartment(string departmentId, DateTime monthStart) => new() { "EXP-1001" };

    public static void SaveApprovedTotal(string departmentId, Money total) => Console.WriteLine($"[DB] {departmentId} の承認合計を保存しました");
}

public static class FakeBank
{
    public static void Transfer(BankTransfer transfer) => Console.WriteLine($"[銀行] {transfer.BankAccount} へ {transfer.FormattedAmount} を振り込みました");
}

// 名前が合うフィールドだけに値を入れる。Expense にも Money にも使い回せる(フィールドの持ち主は模範解答の途中で変わる)
public static class SampleValues
{
    public static void Set(object target, string name, object value) => target.GetType().GetField(name)?.SetValue(target, value);

    public static void Apply(object target)
    {
        Set(target, "amount", 1200m);
        Set(target, "currency", "JPY");
        Set(target, "category", "Travel");
        Set(target, "status", "Draft");
    }
}

public partial class Expense
{
    public Expense() => SampleValues.Apply(this);
}

public partial class Money
{
    public Money() => SampleValues.Apply(this);

    public Money(decimal amount, string currency)
    {
        SampleValues.Set(this, "amount", amount);
        SampleValues.Set(this, "currency", currency);
    }
}
`),
  ],
};
