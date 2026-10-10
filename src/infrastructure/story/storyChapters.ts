import type { StoryChapter } from '../../domain/story/Story';

const TANAKA = '先輩の田中さん';
const SUZUKI = 'PMの鈴木さん';
const SATO = '営業の佐藤さん';
const TAKAHASHI = 'QAの高橋さん';

/**
 * 架空の会社「ブロック商事」の1年間(4月の入社 → 翌3月)。1章 = 1ステージで、stages と同じ並びで書く。
 * 結び(outro)は、そのステージの最初の変更依頼(changeRequests[0])へつなぐ。
 */
export const storyChapters: readonly StoryChapter[] = [
  {
    stageId: 'tutorial-extract-method',
    title: '入社1日目、最初のコード',
    speaker: TANAKA,
    intro: 'ブロック商事へようこそ。まずは売上レポートを作るコードを見てほしい。1つのメソッドに処理が全部入っていて、読むだけで疲れるんだ。ここから整えてみよう。',
    outro: '4月の終わり。営業の佐藤さんが席に来ました。「あのレポート、こういうことはできる?」',
  },
  {
    stageId: 'tutorial-order-service',
    title: '注文を受ける placeOrder',
    speaker: TANAKA,
    intro: '次は注文を受け付けるサービスだ。placeOrder が何でもやっていて、税の扱いまで抱え込んでいる。ここも、ひとつずつ整理していこう。',
    outro: '5月の連休明け。PMの鈴木さんが相談に来ました。「税の扱いについて、お客様から依頼が来ています」',
  },
  {
    stageId: 'beginner-user-controller',
    title: 'ユーザー登録の窓口',
    speaker: SUZUKI,
    intro: '今月からユーザー登録まわりをお願いします。UserController が、登録も保存もメール送信も、1人でやっているんです。担当を分けてあげてください。',
    outro: '6月。営業の佐藤さんから連絡です。「登録時のメールについて、お客様から要望が出ています」',
  },
  {
    stageId: 'beginner-invoice-service',
    title: '請求書まわりを任される',
    speaker: TANAKA,
    intro: '請求書の処理を、君に任せることにした。InvoiceService に役割がいくつも混ざっている。受け皿になるクラスは、自分で作ってみてほしい。',
    outro: '7月の暑い日。経理から請求書について、こんな依頼が回ってきました。',
  },
  {
    stageId: 'intermediate-cyclic-dependency',
    title: 'お互いを呼び合うクラス',
    speaker: TANAKA,
    intro: '価格まわりのコードを開いたら、クラス同士が呼び合っていた。片方を直すともう片方が壊れる、という報告も上がっている。絡まりをほどいてくれるかな。',
    outro: '8月。営業の佐藤さんが言いました。「価格のルールを変えたいんです。急ぎではないけれど」',
  },
  {
    stageId: 'intermediate-god-file',
    title: '1つのファイルに全部入り',
    speaker: SUZUKI,
    intro: '出荷まわりのファイルが、とても大きくなっています。誰も全体を把握できていません。持ち主ごとに、ファイルを分けてもらえますか。',
    outro: '9月に入ってすぐ。営業の佐藤さんが、送料について相談に来ました。',
  },
  {
    stageId: 'intermediate-misplaced-private',
    title: '通知の裏口',
    speaker: TAKAHASHI,
    intro: 'QAの高橋です。通知のコードを調べていたら、private のはずのメソッドが他のクラスから呼ばれていました。仕組みの外から触っている形です。見直してもらえますか。',
    outro: '9月の終わり。PMの鈴木さんから、通知について新しい依頼が届きました。',
  },
  {
    stageId: 'intermediate-volatile-tax',
    title: '変わりやすい税の計算',
    speaker: TANAKA,
    intro: '税の計算は、法律が変わるたびに直している。直す場所が散らばると大変だ。変わりやすいところは、あらかじめ1か所に寄せておきたい。',
    outro: '10月。営業の佐藤さんが、お客様からの声を伝えに来ました。',
  },
  {
    stageId: 'intermediate-volatile-format',
    title: '取引先ごとに違う帳票',
    speaker: SATO,
    intro: '営業の佐藤です。取引先ごとに帳票の形式が違って、そのたびに依頼を出していました。コードの側で、変わる部分を閉じ込めてもらえると助かります。',
    outro: '10月の下旬。さっそく、ある取引先から帳票の依頼が来ました。',
  },
  {
    stageId: 'intermediate-feature-envy',
    title: '他人のデータを触りたがるメソッド',
    speaker: TANAKA,
    intro: 'コードレビューで気づいたんだが、他クラスのデータばかり触るメソッドがある。仕事はデータを持つクラスに頼むほうが、自然な形になるはずだ。',
    outro: '11月。PMの鈴木さんが、料金プランの見直しを持ってきました。',
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    title: '口座クラスの悩み',
    speaker: TAKAHASHI,
    intro: '口座まわりのテストを書いていて困っています。Account は値を出し入れするだけで、ルールはあちこちの外側に散らばっているんです。',
    outro: '11月の終わり。営業の佐藤さんから、会員向けの新しい要望が届きました。',
  },
  {
    stageId: 'intermediate-extract-class',
    title: '社員クラスが抱えすぎている',
    speaker: SUZUKI,
    intro: '人事システムの社員クラスが、給与の項目も住所の項目も持っています。後から機能を足すたびに、膨らむ一方です。切り分けられそうなところを探してください。',
    outro: '12月の忙しい時期。人事から、社員情報について依頼が来ました。',
  },
  {
    stageId: 'intermediate-copy-paste-tax',
    title: 'コピペされた消費税',
    speaker: TAKAHASHI,
    intro: 'テスト中に、同じ消費税の計算が3か所にあるのを見つけました。1か所だけ直して、他が古いまま残るのが怖いんです。',
    outro: '年が明けて1月。税制の改正があり、佐藤さんが走ってきました。',
  },
  {
    stageId: 'intermediate-member-rank-branching',
    title: '会員ランクのif分岐',
    speaker: TANAKA,
    intro: '会員ランクごとに、価格と送料を if で書き分けている。新しいランクが増えるたびに、分岐も増えていく。この形のまま増やしていくのは苦しい。',
    outro: '1月の終わり。営業の佐藤さんが、新しい会員の区分を提案してきました。',
  },
  {
    stageId: 'intermediate-layered-order-api',
    title: '注文APIの全部入り Controller',
    speaker: SUZUKI,
    intro: '注文APIの Controller に、受付も計算も保存も書かれています。チームが増えたので、誰がどこを直せばよいか分かるようにしたいんです。',
    outro: '2月。インフラ担当から、保存まわりについて連絡が入りました。',
  },
  {
    stageId: 'intermediate-middle-man',
    title: '横流しするだけの注文管理',
    speaker: TANAKA,
    intro: 'OrderManager を経由して OrderService を呼んでいますが、ここには独自の処理がありません。分ける理由がなくなった層を整理してください。',
    outro: '2月の半ば。QAの高橋さんから、注文の受付とキャンセルについて確認がありました。',
  },
  {
    stageId: 'advanced-notifier-hierarchy',
    title: '通知クラスの共通処理',
    speaker: TANAKA,
    intro: 'メール通知とSMS通知に、同じログ処理が重複している。共通のところは親にまとめたいが、通知文は違うので残さないといけない。見極めてほしい。',
    outro: '2月の中ごろ。PMの鈴木さんが、通知の文面について依頼を持ってきました。',
  },
  {
    stageId: 'advanced-payment-gateway-interface',
    title: '決済の窓口を揃える',
    speaker: SUZUKI,
    intro: '決済は事業の要です。会社ごとにAPIが違っても、PaymentService からは同じ形で呼びたいと思っています。つなぎ方を整えてください。',
    outro: '2月の終わり。営業の佐藤さんから、新しい決済手段の相談が届きました。',
  },
  {
    stageId: 'advanced-discount-strategy',
    title: '会員ランクの割引ルール',
    speaker: SATO,
    intro: '営業の佐藤です。ランクごとに割引のルールが違い、キャンペーンのたびに調整しています。ランクごとに、別々に直せる形にできませんか。',
    outro: '3月に入って、キャンペーンの準備が始まりました。佐藤さんから相談です。',
  },
  {
    stageId: 'advanced-report-factory',
    title: 'レポートの組み立て',
    speaker: TANAKA,
    intro: 'レポートを組み立てる処理が、あちこちで重複している。組み立てる役を1つのクラスに任せたい。ただし、継承には頼らない形でやってみてほしい。',
    outro: '3月上旬。年度末のレポートを前に、PMの鈴木さんから依頼がありました。',
  },
  {
    stageId: 'advanced-collapse-hierarchy',
    title: '使われない拡張ポイント',
    speaker: TAKAHASHI,
    intro: '出力まわりに、子が1つしかない継承があります。拡張のために作ったようですが、実際には使われていません。読む人が迷う原因になっています。',
    outro: '3月の中ごろ。出力形式について、経理から要望が届きました。',
  },
  {
    stageId: 'advanced-interface-segregation',
    title: '太ったインターフェース',
    speaker: TANAKA,
    intro: 'チャットとタスク管理の機能が、1つのインターフェースに押し込まれている。片方しか使わないクラスまで、空のメソッドを持たされているんだ。',
    outro: '3月。障害対応の振り返りで、運用担当から依頼が来ました。',
  },
  {
    stageId: 'advanced-value-object',
    title: '金額と通貨をひとまとまりに',
    speaker: SUZUKI,
    intro: '経費精算で、金額と通貨がバラバラに持ち回されています。海外の取引が増えるので、お金をひとまとまりで扱える形にしたいんです。',
    outro: '3月の下旬。海外支社から、経費精算の依頼が届きました。',
  },
  {
    stageId: 'advanced-template-method',
    title: '最後の章、取り込みの手順',
    speaker: TANAKA,
    intro: '1年の締めくくりだ。注文の取り込み処理は、手順が同じで、変換のところだけが違う。共通の流れを親が持つ形に整えてみてほしい。',
    outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。',
  },
];
