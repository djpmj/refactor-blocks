import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 中級7: Account の private フィールドを getter/setter 越しに触る AccountService。
 * フィールドに初期値を書けないので、取引履歴・通知の偽物は「何もしなくても使える struct」にし、
 * Account の初期値は補助コードの partial クラスのコンストラクタで与える。
 * 移したメソッドを public にするまで、AccountService から private メソッドを呼ぶことになるので、その手順(02・05)はビルドに失敗する。
 */
export const intermediateAnemicDomainModelRuntime: StageRuntime = {
  entryMethodId: 'method-withdraw',
  entryArguments: ['1', '3000m', '100000m', '42'],
  expectedBuildFailures: ['02', '05'],
  support: [
    logFile,
    supportFile('Account.cs', `
public struct TransactionLog
{
    public void Append(int accountId, decimal amount)
    {
        Console.WriteLine($"[履歴] 口座 {accountId} に {amount} 円の取引を追記しました");
    }
}

public struct Notifier
{
    public void Send(int customerId, string message)
    {
        Console.WriteLine($"[通知] 顧客 {customerId} へ「{message}」を送りました");
    }

    public void RecordDelivery(int customerId)
    {
        Console.WriteLine($"[通知] 顧客 {customerId} への送信を記録しました");
    }
}

public partial class Account
{
    public Account()
    {
        balance = 50000m;
        status = "Active";
    }
}
`),
  ],
};
