import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級6: 太いインターフェース CollaborationTool を、投稿(ChatClient)とタスク管理(TaskTracker)に分ける。
 * 入口は AlertNotifier.notifyAlert(投稿だけ使う)。注入する実装は、両方できる ChatworkClient にそろえる。
 * 分ける途中でインターフェース名が変わる(CollaborationTool → ChatClient、新しく TaskTracker)ので、どの名前でも ChatworkClient を指すようにしておく。
 * チャット・課題管理の API は、何をしたかを1行出す偽物。
 */
export const advancedInterfaceSegregationRuntime: StageRuntime = {
  entryMethodId: 'method-notify-alert',
  entryArguments: ['SampleData.Alert', '"#incident"'],
  bindings: { CollaborationTool: 'ChatworkClient', ChatClient: 'ChatworkClient', TaskTracker: 'ChatworkClient' },
  support: [
    logFile,
    supportFile('Incident.cs', `
public enum IncidentSeverity
{
    Normal,
    High,
}

public class Alert
{
    public IncidentSeverity Severity;
    public string Title;
    public string Description;
}

public class ChatMessage
{
    public ChatMessage(string channel, string body)
    {
        Channel = channel;
        Body = body;
    }

    public string Channel { get; }

    public string Body { get; }
}

public class Incident
{
    public string Id;
    public bool IsRecovered;
}

public class IncidentTask
{
    public IncidentTask(string incidentId, IncidentSeverity severity)
    {
        IncidentId = incidentId;
        Severity = severity;
    }

    public string IncidentId { get; }

    public IncidentSeverity Severity { get; }
}

public static class FakeHttp
{
    public static void Post(string service, string payload) => Console.WriteLine($"[{service}] {payload}");
}

public static class SampleData
{
    public static readonly Alert Alert = new()
    {
        Severity = IncidentSeverity.High,
        Title = "決済APIの応答遅延",
        Description = "5分間の平均応答が3秒を超えています",
    };
}
`),
  ],
};
