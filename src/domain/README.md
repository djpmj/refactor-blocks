# domain

フレームワーク・外部ライブラリに依存しない、純粋なTypeScriptのドメインモデル層。

- エンティティ・値オブジェクト・ドメインサービスをここに置く
- React・Zustand・localStorage・fetch など外部への依存を持ち込まない
- すべてのロジックはTDD(Red→Green→Refactor)で、`*.test.ts`をペアで書く
