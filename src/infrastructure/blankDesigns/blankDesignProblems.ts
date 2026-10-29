import type { BlankDesignProblem } from '../../domain/blank/BlankDesignProblem';
import { trayCodebase } from '../../domain/blank/tray';
import type { Method } from '../../domain/codebase/Codebase';

const placeOrder: Method = {
  id: 'method-blank-place-order',
  name: 'placeOrder',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-place-order',
      label: '注文を受け付け、税の計算・保存・確認メールを順に呼ぶ',
      lines: 3,
      responsibility: 'order-flow',
      uses: ['method-blank-calculate-order-tax', 'method-blank-save-order', 'method-blank-send-order-confirm-mail'],
     code: { csharp: "var taxedAmount = calculateOrderTax(amount);\nsaveOrder(taxedAmount);\nsendOrderConfirmMail(taxedAmount);" }},
  ],
};
const shipOrder: Method = {
  id: 'method-blank-ship-order',
  name: 'shipOrder',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-ship-order',
      label: '発送を受け付け、発送状況の記録・発送メールを順に呼ぶ',
      lines: 3,
      responsibility: 'order-flow',
      uses: ['method-blank-update-shipping-status', 'method-blank-send-shipped-mail'],
     code: { csharp: "await updateShippingStatus(orderId, cancellationToken);\nvar message = new MailMessage(recipient, subject, body);\nawait sendShippedMail(message, cancellationToken);" }},
  ],
};
const calculateOrderTax: Method = {
  id: 'method-blank-calculate-order-tax',
  name: 'calculateOrderTax',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-calculate-order-tax', label: '注文金額に消費税を足す', lines: 3, responsibility: 'tax' , code: { csharp: "var taxRate = isReducedRate ? reducedTaxRate : standardTaxRate;\nvar taxAmount = decimal.Round(amount * taxRate, 0, MidpointRounding.AwayFromZero);\nreturn amount + taxAmount;" }}],
};
const saveOrder: Method = {
  id: 'method-blank-save-order',
  name: 'saveOrder',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-save-order', label: '注文をDBに保存する', lines: 4, responsibility: 'persistence' , code: { csharp: "var entity = Order.FromAmount(amount);\nawait _repository.SaveAsync(entity, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);\nreturn entity.Id;" }}],
};
const updateShippingStatus: Method = {
  id: 'method-blank-update-shipping-status',
  name: 'updateShippingStatus',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-update-shipping-status', label: '発送状況をDBに記録する', lines: 3, responsibility: 'persistence' , code: { csharp: "if (orderId <= 0) throw new ArgumentOutOfRangeException(nameof(orderId));\nvar updated = await _shippingRepository.UpdateStatusAsync(orderId, \"Shipped\", DateTimeOffset.UtcNow, cancellationToken);\nreturn updated;" }}],
};
const sendOrderConfirmMail: Method = {
  id: 'method-blank-send-order-confirm-mail',
  name: 'sendOrderConfirmMail',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-send-order-confirm-mail', label: '注文確認メールを送る', lines: 3, responsibility: 'notification' , code: { csharp: "var message = new MailMessage(recipient, subject, body);\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }}],
};
const sendShippedMail: Method = {
  id: 'method-blank-send-shipped-mail',
  name: 'sendShippedMail',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-send-shipped-mail', label: '発送完了メールを送る', lines: 3, responsibility: 'notification' , code: { csharp: "var message = new MailMessage(recipient, subject, body);\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }}],
};

const orderShippingParts = [placeOrder, shipOrder, calculateOrderTax, saveOrder, updateShippingStatus, sendOrderConfirmMail, sendShippedMail];

const reserveRoom: Method = {
  id: 'method-blank-reserve-room',
  name: 'reserveRoom',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-reserve-room',
      label: '予約を受け付け、空き確認・保存・カレンダー登録を順に呼ぶ',
      lines: 3,
      responsibility: 'reservation-flow',
      uses: ['method-blank-check-room-availability', 'method-blank-save-reservation', 'method-blank-add-to-calendar'],
      code: { csharp: 'var isAvailable = checkRoomAvailability(roomId, period);\nsaveReservation(roomId, period, isAvailable);\naddToCalendar(roomId, period);' },
    },
  ],
};
const cancelReservation: Method = {
  id: 'method-blank-cancel-reservation',
  name: 'cancelReservation',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-cancel-reservation',
      label: '取消を受け付け、予約の削除・カレンダーからの削除を順に呼ぶ',
      lines: 2,
      responsibility: 'reservation-flow',
      uses: ['method-blank-delete-reservation', 'method-blank-remove-from-calendar'],
      code: { csharp: 'deleteReservation(reservationId);\nremoveFromCalendar(reservationId);' },
    },
  ],
};
const checkRoomAvailability: Method = {
  id: 'method-blank-check-room-availability',
  name: 'checkRoomAvailability',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-check-room-availability',
      label: '希望の時間帯に会議室が空いているか確かめる',
      lines: 4,
      responsibility: 'availability',
      code: {
        csharp:
          'var existing = await _reservations.FindByRoomAsync(roomId, period, cancellationToken);\nif (existing.Count == 0) return true;\nvar overlaps = existing.Any(reservation => reservation.Period.Overlaps(period));\nreturn !overlaps;',
      },
    },
  ],
};
const saveReservation: Method = {
  id: 'method-blank-save-reservation',
  name: 'saveReservation',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-save-reservation',
      label: '予約をDBに保存する',
      lines: 3,
      responsibility: 'persistence',
      code: {
        csharp:
          'var entity = Reservation.Create(roomId, period);\nawait _repository.SaveAsync(entity, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);',
      },
    },
  ],
};
const deleteReservation: Method = {
  id: 'method-blank-delete-reservation',
  name: 'deleteReservation',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-delete-reservation',
      label: '予約をDBから削除する',
      lines: 3,
      responsibility: 'persistence',
      code: {
        csharp:
          'var entity = await _repository.FindAsync(reservationId, cancellationToken);\nawait _repository.DeleteAsync(entity, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);',
      },
    },
  ],
};
const addToCalendar: Method = {
  id: 'method-blank-add-to-calendar',
  name: 'addToCalendar',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-add-to-calendar',
      label: '予約を社内カレンダーに登録する',
      lines: 3,
      responsibility: 'calendar',
      code: {
        csharp:
          'var calendarEvent = new CalendarEvent(roomId, period.Start, period.End);\nawait _calendar.InsertAsync(calendarEvent, cancellationToken);\nawait _calendarAuditLog.RecordAsync(calendarEvent.Id, cancellationToken);',
      },
    },
  ],
};
const removeFromCalendar: Method = {
  id: 'method-blank-remove-from-calendar',
  name: 'removeFromCalendar',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-remove-from-calendar',
      label: '予約を社内カレンダーから削除する',
      lines: 3,
      responsibility: 'calendar',
      code: {
        csharp:
          'var calendarEvent = await _calendar.FindByReservationAsync(reservationId, cancellationToken);\nawait _calendar.DeleteAsync(calendarEvent.Id, cancellationToken);\nawait _calendarAuditLog.RecordAsync(calendarEvent.Id, cancellationToken);',
      },
    },
  ],
};

const roomReservationParts = [reserveRoom, cancelReservation, checkRoomAvailability, saveReservation, deleteReservation, addToCalendar, removeFromCalendar];

const clockIn: Method = {
  id: 'method-blank-clock-in',
  name: 'clockIn',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-clock-in',
      label: '出勤の打刻を受け付け、記録の保存を呼ぶ',
      lines: 2,
      responsibility: 'attendance-flow',
      uses: ['method-blank-save-clock-in'],
      code: { csharp: 'var clockedInAt = _clock.UtcNow;\nsaveClockIn(employeeId, clockedInAt);' },
    },
  ],
};
const clockOut: Method = {
  id: 'method-blank-clock-out',
  name: 'clockOut',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-clock-out',
      label: '退勤の打刻を受け付け、保存・残業の計算・上長への通知を順に呼ぶ',
      lines: 3,
      responsibility: 'attendance-flow',
      uses: ['method-blank-save-clock-out', 'method-blank-calculate-overtime', 'method-blank-alert-overtime'],
      code: { csharp: 'saveClockOut(employeeId, clockedOutAt);\nvar overtime = calculateOvertime(employeeId, clockedOutAt);\nalertOvertime(employeeId, overtime);' },
    },
  ],
};
const saveClockIn: Method = {
  id: 'method-blank-save-clock-in',
  name: 'saveClockIn',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-save-clock-in',
      label: '出勤の記録をDBに保存する',
      lines: 3,
      responsibility: 'persistence',
      code: {
        csharp:
          'var record = AttendanceRecord.ClockIn(employeeId, clockedInAt);\nawait _repository.SaveAsync(record, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);',
      },
    },
  ],
};
const saveClockOut: Method = {
  id: 'method-blank-save-clock-out',
  name: 'saveClockOut',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-save-clock-out',
      label: '退勤の記録をDBに保存する',
      lines: 3,
      responsibility: 'persistence',
      code: {
        csharp:
          'var record = await _repository.FindOpenAsync(employeeId, cancellationToken);\nrecord.ClockOut(clockedOutAt);\nawait _unitOfWork.CommitAsync(cancellationToken);',
      },
    },
  ],
};
const calculateOvertime: Method = {
  id: 'method-blank-calculate-overtime',
  name: 'calculateOvertime',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-calculate-overtime',
      label: '1日の勤務時間から残業時間を計算する',
      lines: 4,
      responsibility: 'overtime',
      code: {
        csharp:
          'var worked = clockedOutAt - record.ClockedInAt - record.BreakTime;\nvar regular = TimeSpan.FromHours(8);\nif (worked <= regular) return TimeSpan.Zero;\nreturn worked - regular;',
      },
    },
  ],
};
const alertOvertime: Method = {
  id: 'method-blank-alert-overtime',
  name: 'alertOvertime',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-alert-overtime',
      label: '残業が多いとき、上長にメールで知らせる',
      lines: 3,
      responsibility: 'alert',
      code: {
        csharp:
          'if (overtime < _alertThreshold) return;\nvar message = new MailMessage(manager.Address, "残業時間の通知", body);\nawait _mailer.SendAsync(message, cancellationToken);',
      },
    },
  ],
};
const summarizeMonthlyOvertime: Method = {
  id: 'method-blank-summarize-monthly-overtime',
  name: 'summarizeMonthlyOvertime',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-summarize-monthly-overtime',
      label: '1か月分の残業時間を合計する',
      lines: 4,
      responsibility: 'overtime',
      code: {
        csharp:
          'var records = await _repository.FindByMonthAsync(employeeId, month, cancellationToken);\nvar total = TimeSpan.Zero;\nforeach (var record in records) total += record.Overtime;\nreturn total;',
      },
    },
  ],
};

const attendanceParts = [clockIn, clockOut, saveClockIn, saveClockOut, calculateOvertime, alertOvertime, summarizeMonthlyOvertime];

/** 白紙設計の問題の一覧。ステージ一覧・ステージ選択・進捗には入れない。 */
export const blankDesignProblems: readonly BlankDesignProblem[] = [
  {
    responsibilityNames: { 'order-flow': '注文の流れ', tax: '税の計算', persistence: 'DBへの保存', notification: 'メール通知' },
    classNames: {
      'order-flow': 'OrderService',
      tax: 'TaxCalculator',
      persistence: 'OrderRepository',
      notification: 'OrderMailer',
    },
    id: 'blank-order-shipping',
    level: 'beginner',
    title: '白紙1: 注文と発送',
    learns: ['責務の分離', 'クラス設計'],
    checks: [
      {
        id: 'check-1',
        question: '白紙から設計するとき、注文・税の計算・DB保存・メール送信を別のクラスに分ける、いちばんの理由は?',
        choices: [
          { text: 'クラスを多く作るほど評価が上がるから', explanation: '評価は数ではなく、責務・結合度・行数などで決まります。' },
          { text: '消費税の軽減税率やメール文面の変更が来ても、変更する理由のある部品だけを直せば済むようにするため', explanation: '変わる理由ごとに置き場所を分けておくと、変更の影響が狭くなります。' },
          { text: '1つのクラスに全部書くと、動かなくなるから', explanation: '1クラスでも動きます。問題は動くかどうかではなく、変更のしやすさです。' },
        ],
        answer: 1,
      },
      {
        id: 'check-2',
        question: '部品をクラスに配置するとき、まず何を基準に考えるとよい?',
        choices: [
          { text: '同じ理由で変わる部品(例: メール関連)を同じクラスに集める', explanation: '変わる理由が同じ部品をまとめると、変更が1か所で済みます。' },
          { text: '部品の名前の文字数が近いものを同じクラスにする', explanation: '名前の長さは役割と関係ありません。' },
          { text: '先に見つけた部品から順に1クラスに詰め込む', explanation: '順序では役割の違いが分からず、責務が混ざったクラスになります。' },
        ],
        answer: 0,
      },
    ],
    why: '税率やメール文面を変えるたびに注文と発送の一連の流れを読み直す必要があります。処理の置き場所が分かれていれば、変更先を特定しやすくなります。',
    goal: '部品置き場の7つの部品を、すべて自分で作ったクラスに配置しよう。メソッドは41行・クラスは86行以内、1クラスの責務は1種類、依存先は3クラスまで',
    problem: '注文処理と発送処理に異なる役割が含まれている',
    description:
      'ネットショップの注文と発送の機能を、白紙から設計する。お客さんが注文を確定したら、注文金額に消費税を足し、注文をDBに保存して、注文確認メールを送る。' +
      '倉庫が商品を発送したら、発送状況をDBに記録して、発送完了メールを送る。' +
      'なお、消費税は軽減税率への対応が近いうちに入る予定。メールには、全通共通の文言の追加がよく頼まれる。',
    limits: { method: 41, class: 86, file: 200 },
    dependencyLimit: 3,
    responsibilityLimit: 1,
    codebase: trayCodebase(orderShippingParts),
    changeRequests: [
      {
        id: 'req-blank-mail-footer',
        title: 'メールに配信停止の案内を付けて',
        description: '送るメールすべての末尾に、配信停止の案内を入れたい。',
        responsibility: 'notification',
        linesPerSite: 5,
      },
      {
        id: 'req-blank-reduced-tax',
        title: '軽減税率に対応して',
        description: '食品は8%、それ以外は10%で消費税を計算したい。',
        responsibility: 'tax',
        linesPerSite: 20,
      },
    ],
    modelAnswer: [
      { addFile: 'src/order/OrderService.ts' },
      { addFile: 'src/order/TaxCalculator.ts' },
      { addFile: 'src/order/OrderRepository.ts' },
      { addFile: 'src/mail/OrderMailer.ts' },
      { addClass: { name: 'OrderService', file: 'src/order/OrderService.ts' } },
      { addClass: { name: 'TaxCalculator', file: 'src/order/TaxCalculator.ts' } },
      { addClass: { name: 'OrderRepository', file: 'src/order/OrderRepository.ts' } },
      { addClass: { name: 'OrderMailer', file: 'src/mail/OrderMailer.ts' } },
      { move: { method: 'placeOrder', toClass: 'OrderService' } },
      { move: { method: 'shipOrder', toClass: 'OrderService' } },
      { move: { method: 'calculateOrderTax', toClass: 'TaxCalculator' } },
      { move: { method: 'saveOrder', toClass: 'OrderRepository' } },
      { move: { method: 'updateShippingStatus', toClass: 'OrderRepository' } },
      { move: { method: 'sendOrderConfirmMail', toClass: 'OrderMailer' } },
      { move: { method: 'sendShippedMail', toClass: 'OrderMailer' } },
    ],
    explanation:
      '"注文"と"発送"という機能の流れで分けると、メールやDBの処理が両方のクラスに散らばり、メール共通の変更で2クラスを直すことになる。' +
      '変わる理由(税・保存・メール)ごとにクラスを分け、流れを組み立てるOrderServiceから呼ぶ形にすると、1つの変更が1つのクラスに収まる。' +
      '模範解答と同じ形でなくても、点数が同じなら同じくらい良い設計。',
  },
  {
    id: 'blank-room-reservation',
    level: 'beginner',
    title: '白紙2: 会議室の予約',
    learns: ['責務の分離', 'クラス設計'],
    responsibilityNames: { 'reservation-flow': '予約の流れ', availability: '空き確認', persistence: 'DBへの保存', calendar: 'カレンダー連携' },
    classNames: {
      'reservation-flow': 'ReservationService',
      availability: 'RoomAvailability',
      persistence: 'ReservationRepository',
      calendar: 'CalendarSync',
    },
    checks: [
      {
        id: 'check-1',
        question: '予約・空き確認・DB保存・カレンダー連携を別のクラスに分けておくと、どんなときに助かる?',
        choices: [
          { text: '社内カレンダーを別サービスへ乗り換えるとき、カレンダー連携のクラスだけを直せば済む', explanation: '変わる理由ごとに置き場所を分けておくと、変更の影響が1か所に収まります。' },
          { text: '予約の件数が増えても、処理が自動的に速くなる', explanation: '分け方は速度ではなく、変更のしやすさに効きます。' },
          { text: 'クラスの数が増えるので、コードを書く量が減る', explanation: '分けると書く量はむしろ増えることがあります。得られるのは変更しやすさです。' },
        ],
        answer: 0,
      },
      {
        id: 'check-2',
        question: '「予約する」と「取り消す」の2つのメソッドを、それぞれ別のクラスにまとめる分け方の問題は?',
        choices: [
          { text: '予約と取消が同じクラスに入らないので、動かなくなる', explanation: '分け方によらず動きます。問題は変更のしやすさです。' },
          { text: 'クラスが2つしかできないので、評価されない', explanation: '評価はクラスの数ではなく、責務・結合度・行数などで決まります。' },
          { text: 'どちらのクラスにもDB保存とカレンダー連携の処理が入り、カレンダーの変更で2つのクラスを直すことになる', explanation: '機能の流れで分けると、同じ理由で変わる処理があちこちに散らばります。' },
        ],
        answer: 2,
      },
    ],
    why: '準備時間のルールやカレンダーの乗り換えのたびに、予約の流れ全体を読み直す必要があります。空き確認・保存・カレンダー連携の置き場所が分かれていれば、変更先をすぐ特定できます。',
    goal: '部品置き場の7つの部品を、すべて自分で作ったクラスに配置しよう。メソッドは41行・クラスは86行以内、1クラスの責務は1種類、依存先は3クラスまで',
    problem: '会議室の予約処理に異なる役割が含まれている',
    description:
      '社内の会議室予約の機能を、白紙から設計する。社員が会議室と時間帯を指定して予約したら、その時間帯が空いているかを確かめ、予約をDBに保存して、社内カレンダーに登録する。' +
      '予約を取り消したら、予約をDBから削除して、カレンダーからも消す。' +
      'なお、予約の前後に準備時間を空けるルールが近いうちに入る予定。社内カレンダーを別のサービスへ乗り換える話もある。',
    limits: { method: 41, class: 86, file: 200 },
    dependencyLimit: 3,
    responsibilityLimit: 1,
    codebase: trayCodebase(roomReservationParts),
    changeRequests: [
      {
        id: 'req-blank-room-buffer',
        title: '前後10分の準備時間を空けて',
        description: '予約の前後10分は、ほかの予約を入れられないようにしたい。',
        responsibility: 'availability',
        linesPerSite: 6,
      },
      {
        id: 'req-blank-calendar-switch',
        title: 'カレンダーを別サービスに切り替えて',
        description: '社内カレンダーの登録・削除を、別のカレンダーサービスへ向けたい。',
        responsibility: 'calendar',
        linesPerSite: 12,
      },
    ],
    modelAnswer: [
      { addFile: 'src/reservation/ReservationService.ts' },
      { addFile: 'src/reservation/RoomAvailability.ts' },
      { addFile: 'src/reservation/ReservationRepository.ts' },
      { addFile: 'src/calendar/CalendarSync.ts' },
      { addClass: { name: 'ReservationService', file: 'src/reservation/ReservationService.ts' } },
      { addClass: { name: 'RoomAvailability', file: 'src/reservation/RoomAvailability.ts' } },
      { addClass: { name: 'ReservationRepository', file: 'src/reservation/ReservationRepository.ts' } },
      { addClass: { name: 'CalendarSync', file: 'src/calendar/CalendarSync.ts' } },
      { move: { method: 'reserveRoom', toClass: 'ReservationService' } },
      { move: { method: 'cancelReservation', toClass: 'ReservationService' } },
      { move: { method: 'checkRoomAvailability', toClass: 'RoomAvailability' } },
      { move: { method: 'saveReservation', toClass: 'ReservationRepository' } },
      { move: { method: 'deleteReservation', toClass: 'ReservationRepository' } },
      { move: { method: 'addToCalendar', toClass: 'CalendarSync' } },
      { move: { method: 'removeFromCalendar', toClass: 'CalendarSync' } },
    ],
    explanation:
      '"予約"と"取消"という機能の流れで分けると、DBやカレンダーの処理が両方のクラスに散らばり、カレンダーの乗り換えで2クラスを直すことになる。' +
      '変わる理由(空き確認・保存・カレンダー連携)ごとにクラスを分け、流れを組み立てるReservationServiceから呼ぶ形にすると、1つの変更が1つのクラスに収まる。' +
      '模範解答と同じ形でなくても、点数が同じなら同じくらい良い設計。',
  },
  {
    id: 'blank-attendance',
    level: 'beginner',
    title: '白紙3: 勤怠の打刻',
    learns: ['責務の分離', 'クラス設計'],
    responsibilityNames: { 'attendance-flow': '打刻の流れ', persistence: 'DBへの保存', overtime: '残業の計算', alert: '上長への通知' },
    classNames: {
      'attendance-flow': 'AttendanceService',
      persistence: 'AttendanceRepository',
      overtime: 'OvertimeCalculator',
      alert: 'ManagerNotifier',
    },
    checks: [
      {
        id: 'check-1',
        question: '残業の計算を、打刻の流れや通知とは別のクラスに置くと、どんなときに助かる?',
        choices: [
          { text: '深夜の割増のような計算ルールが増えても、残業の計算のクラスだけを直せば済む', explanation: '変わる理由が同じ処理を1か所に集めると、変更の影響が狭くなります。' },
          { text: '打刻の時刻がずれなくなる', explanation: '分け方は計算結果ではなく、変更のしやすさに効きます。' },
          { text: '残業を計算しなくてよくなる', explanation: '分けても処理そのものは必要です。置き場所が変わるだけです。' },
        ],
        answer: 0,
      },
      {
        id: 'check-2',
        question: '「出勤」と「退勤」の2つのメソッドを、それぞれ別のクラスにまとめる分け方の問題は?',
        choices: [
          { text: '出勤と退勤が別クラスだと、動かなくなる', explanation: '分け方によらず動きます。問題は変更のしやすさです。' },
          { text: 'クラスが2つしかできないので、必ず減点される', explanation: '評価は数ではなく、責務・結合度・行数などで決まります。' },
          { text: '退勤側のクラスに保存・残業の計算・通知がまとまり、通知先を変えるたびにそのクラスの中身を読み直すことになる', explanation: '機能の流れで分けると、変わる理由の違う処理が同じクラスに混ざります。' },
        ],
        answer: 2,
      },
    ],
    why: '深夜の割増や通知先の変更のたびに、打刻の流れ全体を読み直す必要があります。保存・残業の計算・通知の置き場所が分かれていれば、変更先をすぐ特定できます。',
    goal: '部品置き場の7つの部品を、すべて自分で作ったクラスに配置しよう。メソッドは41行・クラスは86行以内、1クラスの責務は1種類、依存先は3クラスまで',
    problem: '勤怠の打刻処理に異なる役割が含まれている',
    description:
      '社員の勤怠管理の機能を、白紙から設計する。社員が出勤を打刻したら、出勤の記録をDBに保存する。' +
      '退勤を打刻したら、退勤の記録をDBに保存して、その日の残業時間を計算し、残業が多いときは上長に知らせる。月末には、1か月分の残業時間を合計する。' +
      'なお、深夜の割増の計算が近いうちに入る予定。上長への通知先をメールからチャットへ変える話もある。',
    limits: { method: 41, class: 86, file: 200 },
    dependencyLimit: 3,
    responsibilityLimit: 1,
    codebase: trayCodebase(attendanceParts),
    changeRequests: [
      {
        id: 'req-blank-night-overtime',
        title: '深夜残業を分けて計算して',
        description: '22時以降の残業は、割増率を変えて別に計算したい。',
        responsibility: 'overtime',
        linesPerSite: 10,
      },
      {
        id: 'req-blank-alert-channel',
        title: '上長への通知をチャットにして',
        description: '残業の通知を、メールではなく社内チャットへ送りたい。',
        responsibility: 'alert',
        linesPerSite: 8,
      },
    ],
    modelAnswer: [
      { addFile: 'src/attendance/AttendanceService.ts' },
      { addFile: 'src/attendance/AttendanceRepository.ts' },
      { addFile: 'src/attendance/OvertimeCalculator.ts' },
      { addFile: 'src/notification/ManagerNotifier.ts' },
      { addClass: { name: 'AttendanceService', file: 'src/attendance/AttendanceService.ts' } },
      { addClass: { name: 'AttendanceRepository', file: 'src/attendance/AttendanceRepository.ts' } },
      { addClass: { name: 'OvertimeCalculator', file: 'src/attendance/OvertimeCalculator.ts' } },
      { addClass: { name: 'ManagerNotifier', file: 'src/notification/ManagerNotifier.ts' } },
      { move: { method: 'clockIn', toClass: 'AttendanceService' } },
      { move: { method: 'clockOut', toClass: 'AttendanceService' } },
      { move: { method: 'saveClockIn', toClass: 'AttendanceRepository' } },
      { move: { method: 'saveClockOut', toClass: 'AttendanceRepository' } },
      { move: { method: 'calculateOvertime', toClass: 'OvertimeCalculator' } },
      { move: { method: 'summarizeMonthlyOvertime', toClass: 'OvertimeCalculator' } },
      { move: { method: 'alertOvertime', toClass: 'ManagerNotifier' } },
    ],
    explanation:
      '"出勤"と"退勤"という機能の流れで分けると、保存・残業の計算・通知が退勤側のクラスに混ざり、通知先や計算ルールの変更でそのクラスを読み直すことになる。' +
      '変わる理由(保存・残業の計算・通知)ごとにクラスを分け、流れを組み立てるAttendanceServiceから呼ぶ形にすると、1つの変更が1つのクラスに収まる。' +
      '模範解答と同じ形でなくても、点数が同じなら同じくらい良い設計。',
  },
];
