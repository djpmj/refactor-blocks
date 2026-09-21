import { Panel } from '@xyflow/react';
import { useState, type SubmitEvent } from 'react';
import { useGameStore } from '../store/useGameStore';

function AddClassForm() {
  const files = useGameStore((state) => state.codebase.files);
  const addClass = useGameStore((state) => state.addClass);
  const [className, setClassName] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  // 選んだファイルが無くなっていたら先頭のファイルに追加する
  const fileId = files.find((file) => file.id === selectedFileId)?.id ?? files.at(0)?.id;

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (fileId !== undefined && addClass(fileId, className)) setClassName('');
  };

  return (
    <form className="canvas-toolbar__form" onSubmit={handleSubmit}>
      <input
        aria-label="新しいクラス名"
        placeholder="クラス名"
        value={className}
        onChange={(event) => {
          setClassName(event.target.value);
        }}
      />
      <select
        aria-label="クラスの追加先ファイル"
        value={fileId}
        onChange={(event) => {
          setSelectedFileId(event.target.value);
        }}
      >
        {files.map((file) => (
          <option key={file.id} value={file.id}>
            {file.path}
          </option>
        ))}
      </select>
      <button type="submit">クラスを追加</button>
    </form>
  );
}

function AddFileForm() {
  const addFile = useGameStore((state) => state.addFile);
  const [path, setPath] = useState('');

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (addFile(path)) setPath('');
  };

  return (
    <form className="canvas-toolbar__form" onSubmit={handleSubmit}>
      <input
        aria-label="新しいファイルのパス"
        placeholder="src/foo/Foo.ts"
        value={path}
        onChange={(event) => {
          setPath(event.target.value);
        }}
      />
      <button type="submit">ファイルを追加</button>
    </form>
  );
}

/** キャンバス上部の、クラス・ファイルを新しく作るツールバー。 */
export function CanvasToolbar() {
  return (
    <Panel position="top-left" className="canvas-toolbar">
      <AddClassForm />
      <AddFileForm />
    </Panel>
  );
}
