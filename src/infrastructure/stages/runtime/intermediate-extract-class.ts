import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 中級8: Employee から住所の塊を Address へ分ける。
 * 給与のフィールドの初期値は、補助コードの partial クラスのコンストラクタで与える(住所のフィールドは途中で移るので触らない)。
 * 住所のフィールドと、それを使うメソッドが別々のクラスにいる手順(04〜07)は、private フィールドを外から読むのでビルドに失敗する。
 */
export const intermediateExtractClassRuntime: StageRuntime = {
  entryMethodId: 'method-calculate-monthly-pay',
  entryArguments: ['12m', 'false', 'new Payroll()'],
  expectedBuildFailures: ['04', '05', '06', '07'],
  support: [
    logFile,
    supportFile('Employee.cs', `
public class Payroll
{
    public decimal NetSalary;
}

public class BankAccount
{
    public BankAccount(string number)
    {
        Number = number;
    }

    public string Number { get; }
}

public class BankTransfer
{
    public BankTransfer(BankAccount account, decimal amount)
    {
        Account = account;
        Amount = amount;
    }

    public BankAccount Account { get; }

    public decimal Amount { get; }
}

public class AddressInput
{
    public string PostalCode;
    public string Prefecture;
    public string AddressLine;
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public partial class Employee
{
    public Employee()
    {
        baseSalary = 300000m;
        overtimeRate = 2500m;
        bankAccount = new BankAccount("0012345");
    }
}
`),
  ],
};
