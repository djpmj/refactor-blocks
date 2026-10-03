---
name: ponytail-review
description: 過剰設計だけを狙うレビュー(ponytail流)。差分・リポジトリ全体から「消せるもの・標準機能で置き換えられるもの」を1行ずつ挙げる。`debt` を付けると `// ponytail:` コメントの手抜き台帳を出す。「過剰設計をレビューして」「消せるものは?」「ponytail-review」「ponytail debt」のような依頼で使う。修正はしない。
argument-hint: "[diff|repo|debt]"
---

# ponytail-review

`CLAUDE.md` の「実装方針: ponytail」に照らして、複雑すぎるものだけを探す。正しさ・セキュリティ・性能のバグは対象外(通常のレビューや `evaluator` に回す)。
一覧を出すだけで、修正はしない。

## 対象(引数)

- `diff`(省略時): `git diff master...HEAD` と未コミットの変更
- `repo`: `src/` と `e2e/` 全体。削れる量が大きい順に並べる
- `debt`: `// ponytail:` コメントの台帳(下記)

## 指摘の書式(diff / repo)

1指摘1行: `<file>:L<行>: <タグ> <消すもの>。<置き換え>。`

- `delete:` 使われていないコード・柔軟性・推測で足した機能。置き換えは「なし」
- `reuse:` リポジトリにすでにあるもの(`Result`・`lineCount` など)の再実装。既存の名前を書く
- `stdlib:` 標準機能の自作。関数名を書く
- `native:` ブラウザ・CSS・React Flow/dnd-kitの標準機能で済むもの。機能名を書く
- `yagni:` 実装が1つしかないinterface、1つしか作らないfactory、誰も変えない設定、呼び出し元が1つの層
- `shrink:` 同じロジックをもっと短く。短い形を示す

最後に `net: -<N>行 削減可能`。削るものがなければ `十分に簡潔。出荷してよし。` とだけ書く。

指摘してはいけないもの(`CLAUDE.md` で明示的に決めているため):
DDDの4層の分け方そのもの、`Result`型での失敗の返却、`infrastructure` が `application` のinterfaceを実装する構造、AAAパターンのテスト、E2Eテスト、lintルールを満たすための分割。

## debt(手抜き台帳)

`// ponytail:` コメントを集めて、「あとで」が「永遠にやらない」にならないようにする。

```bash
git grep -nE '(//|/\*|\{/\*) ?ponytail:' -- src e2e
```

ファイルごとに1行: `<file>:<行>、<何を簡略化したか>。上限: <書かれた上限>。直す契機: <書かれた契機>。`
直す契機が書かれていないものには `no-trigger` を付ける(これが放置されて腐る)。
最後に `<N>件、うち契機なし<M>件`。1件もなければ `ponytail負債なし。`
