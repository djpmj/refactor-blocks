import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { logFile, supportFile } from './supportFiles';

/**
 * 上級8: CSV・JSON の取り込み手順(読む → 変換 → 検証 → 保存)を OrderImporter に集め、変換(parse)だけを子に残す(Template Method)。
 * 入口は ImportController.upload。取り込むファイルは、実行のたびに一時フォルダへ書き出すサンプルの CSV。
 * 保存先は、何件保存したかを1行出す偽物。
 */
export const advancedTemplateMethodRuntime: StageRuntime = {
  entryMethodId: 'method-upload',
  // 09〜11: 統合した readLines・validateOrders・saveOrders が private のまま片方の子クラスに残り、もう一方から呼ぶとビルドに失敗する(CS0122)。
  // 12〜14: 継承を設定したあとも parse がまだ private で、基底の protected な抽象メソッドを実装できない(CS0507・CS0621)。15 で protected に広げるとビルドできる
  expectedBuildFailures: ['09', '10', '11', '12', '13', '14'],
  entryArguments: ['new UploadedFile(SampleFiles.Csv)'],
  // 取り込みの手順を OrderImporter(抽象クラス)へ移したあとは、ImportController が注入するのは CSV 用の子クラスと決める
  bindings: { OrderImporter: 'CsvOrderImporter' },
  support: [
    logFile,
    supportFile('Orders.cs', `
public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}

public class UploadedFile
{
    public UploadedFile(string path)
    {
        Path = path;
    }

    public string Path { get; }
}

public class OrderItem
{
    public decimal UnitPrice { get; set; }
}

public class Order
{
    public int Id { get; set; }

    public string Customer { get; set; } = "";

    public decimal Total { get; set; }

    public List<OrderItem> Items { get; set; } = new();
}

public static class OrderFormats
{
    public static Order FromCsvLine(string line)
    {
        var columns = line.Split(',');
        var total = decimal.Parse(columns[2]);
        return new Order { Id = int.Parse(columns[0]), Customer = columns[1], Total = total, Items = new List<OrderItem> { new OrderItem { UnitPrice = total } } };
    }

    public static List<Order> FromJson(string json) => System.Text.Json.JsonSerializer.Deserialize<List<Order>>(json) ?? new List<Order>();
}

public static class FakeOrderRepository
{
    public static void SaveMany(List<Order> orders) => Console.WriteLine($"[DB] 注文 {orders.Count} 件を保存しました");
}

public static class SampleFiles
{
    public static string Csv => Write("orders.csv", "id,customer,total\\n1001,山田,1500\\n1002,鈴木,2400\\n");

    public static string Json => Write("orders.json", "[{\\"Id\\":1001,\\"Customer\\":\\"山田\\",\\"Total\\":1500,\\"Items\\":[{\\"UnitPrice\\":1500}]}]");

    private static string Write(string name, string content)
    {
        var path = Path.Combine(Path.GetTempPath(), "refactor-blocks-" + name);
        File.WriteAllText(path, content);
        return path;
    }
}
`),
  ],
};
