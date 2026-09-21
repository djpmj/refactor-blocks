# application

ユースケース層。`domain`層のモデルを呼び出して、1つの操作(例: メソッドの抽出、メソッドの別クラスへの移動、ステージの採点)を組み立てる。

- `domain`には依存してよいが、`presentation`(React)には依存しない
- 永続化・外部I/Oは`infrastructure`層のインターフェースを介して呼び出す(直接`localStorage`や`fetch`を書かない)
