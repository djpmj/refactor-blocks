import { useEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/useGameStore';
import type { ContextMenuTarget } from './useCanvasContextMenu';

type Mode = 'menu' | 'class' | 'file';

type NameFormProps = {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => boolean;
};

function NameForm({ label, placeholder, submitLabel, onSubmit }: Readonly<NameFormProps>) {
  const [name, setName] = useState('');
  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    onSubmit(name);
  };
  return (
    <form className="context-menu__form" onSubmit={handleSubmit}>
      <input
        aria-label={label}
        placeholder={placeholder}
        value={name}
        autoFocus
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <button type="submit">{submitLabel}</button>
    </form>
  );
}

/** メニューの外を押したとき・Escapeを押したときに閉じる。 */
function useCloseOnOutside(menuRef: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target) !== true) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuRef, onClose]);
}

type MenuItemsProps = { canAddClass: boolean; onSelect: (mode: Exclude<Mode, 'menu'>) => void };

function MenuItems({ canAddClass, onSelect }: Readonly<MenuItemsProps>) {
  return (
    <div role="menu" aria-label="キャンバスのメニュー">
      {canAddClass ? (
        <button
          type="button"
          role="menuitem"
          autoFocus
          onClick={() => {
            onSelect('class');
          }}
        >
          このファイルにクラスを追加
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        autoFocus={!canAddClass}
        onClick={() => {
          onSelect('file');
        }}
      >
        ファイルを追加
      </button>
    </div>
  );
}

/** キャンバスの右クリックメニュー。クラス・ファイルの追加を、その場で名前を入れて行う。 */
export function CanvasContextMenu({ target, onClose }: Readonly<{ target: ContextMenuTarget; onClose: () => void }>) {
  const file = useGameStore((state) => state.codebase.files.find((candidate) => candidate.id === target.fileId));
  const addClass = useGameStore((state) => state.addClass);
  const addFile = useGameStore((state) => state.addFile);
  const [mode, setMode] = useState<Mode>('menu');
  const menuRef = useRef<HTMLDivElement>(null);

  useCloseOnOutside(menuRef, onClose);

  // 失敗したとき(名前の重複など)は理由がalertに出るので、メニューを開いたまま直してもらう
  const closeIfDone = (done: boolean) => {
    if (done) onClose();
    return done;
  };

  // ponytail: 画面端での位置補正はしていない。右下端ではみ出すと分かったらビューポートに収める
  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left: target.x, top: target.y }} data-testid="context-menu">
      {file === undefined ? null : <div className="context-menu__caption">{file.path}</div>}
      {mode === 'menu' ? <MenuItems canAddClass={file !== undefined} onSelect={setMode} /> : null}
      {mode === 'class' && file !== undefined ? (
        <NameForm
          label="追加するクラス名"
          placeholder="クラス名"
          submitLabel="追加"
          onSubmit={(name) => closeIfDone(addClass(file.id, name))}
        />
      ) : null}
      {mode === 'file' ? (
        <NameForm
          label="追加するファイルのパス"
          placeholder="src/foo/Foo.ts"
          submitLabel="追加"
          onSubmit={(path) => closeIfDone(addFile(path))}
        />
      ) : null}
    </div>,
    document.body,
  );
}
