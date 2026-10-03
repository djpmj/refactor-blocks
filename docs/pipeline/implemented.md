# 実装済みの機能

この一覧には、実装がマージされた機能を記載する。機能ごとの探索結果と仕様草案は、経緯を確認できるよう元の場所に残す。実装の基準となる確定仕様は `docs/specs/<slug>.md` を参照する。

| 機能 | 機能候補 | 仕様草案 | 確定仕様 | 評価 |
| --- | --- | --- | --- | --- |
| 右クリックメニューからメソッド・フィールドを移動 (`move-via-context-menu`) | [探索結果](move-via-context-menu/01-discovered.md) | [草案](move-via-context-menu/02-draft-spec.md) | [仕様](../specs/move-via-context-menu.md) | [評価](move-via-context-menu/06-evaluation.md) |
| 取り込みの手順を Template Method にまとめる (`template-method-stage`) | [探索結果](template-method-stage/01-discovered.md) | [草案](template-method-stage/02-draft-spec.md) | [仕様](../specs/template-method-stage.md) | [評価](template-method-stage/06-evaluation.md) |
| クラス・ファイルの削除で本物の処理が消えないようにする (`delete-class-code-guard`) | (未作成) | (未作成) | [仕様](../specs/delete-class-code-guard.md) | [評価](delete-class-code-guard/06-evaluation.md) |
| 右クリックメニューからクラスを別ファイルへ移動 (`move-class-via-context-menu`) | [探索結果](move-class-via-context-menu/01-discovered.md) | [草案](move-class-via-context-menu/02-draft-spec.md) | [仕様](../specs/move-class-via-context-menu.md) | [評価](move-class-via-context-menu/06-evaluation.md) |
| インターフェース役を extends すると実装漏れの採点をすり抜ける抜け道を塞ぐ (`extends-interface-loophole`) | (未作成) | (未作成) | [仕様](../specs/extends-interface-loophole.md) | [評価](extends-interface-loophole/06-evaluation.md) |
| 具象クラスを extends して契約の実装を借りる抜け道を塞ぐ (`concrete-superclass-loophole`) | [探索結果](concrete-superclass-loophole/01-discovered.md) | [草案](concrete-superclass-loophole/02-draft-spec.md) | [仕様](../specs/concrete-superclass-loophole.md) | [評価](concrete-superclass-loophole/06-evaluation.md) |
