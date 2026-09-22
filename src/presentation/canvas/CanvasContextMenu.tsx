import { useEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { createPortal } from 'react-dom';
import { findClass, findSuperclass } from '../../domain/codebase/Codebase';
import { availableSuperclasses } from '../../domain/codebase/setSuperclass';
import { useGameStore } from '../store/useGameStore';
import type { ContextMenuTarget } from './useCanvasContextMenu';

type Mode = 'menu' | 'class' | 'file' | 'renameClass' | 'renameFile' | 'setSuperclass' | 'setInterface';
type FormMode = Exclude<Mode, 'menu'>;

type NameFormProps = {
  label: string;
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  /** 指定すると自由入力欄の代わりに、この候補だけを選べるセレクトボックスにする。 */
  options?: readonly string[];
  onSubmit: (name: string) => boolean;
};

/** 継承元・実装インターフェースの選択欄。循環にならない相手だけが候補として渡ってくる。 */
function NameSelect({ label, initialValue = '', options, onChange }: Readonly<{ label: string; initialValue?: string; options: readonly string[]; onChange: (name: string) => void }>) {
  return (
    <select
      aria-label={label}
      value={initialValue}
      autoFocus
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      <option value="">(解除)</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function NameForm({ label, initialValue = '', placeholder, submitLabel, options, onSubmit }: Readonly<NameFormProps>) {
  const [name, setName] = useState(initialValue);
  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    onSubmit(name);
  };
  return (
    <form className="context-menu__form" onSubmit={handleSubmit}>
      {options === undefined ? (
        <input
          aria-label={label}
          placeholder={placeholder}
          value={name}
          autoFocus
          onFocus={(event) => {
            event.target.select();
          }}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      ) : (
        <NameSelect label={label} initialValue={initialValue} options={options} onChange={setName} />
      )}
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

type MenuItem = { kind: 'form'; mode: FormMode; label: string } | { kind: 'action'; run: () => void; label: string };

/** 右クリックした場所で使える項目。クラスの上ならクラス、ファイルの上ならファイルに対する項目が増える。 */
function menuItemsFor(target: ContextMenuTarget, onClose: () => void): MenuItem[] {
  const { deleteClass, deleteFile } = useGameStore.getState();
  const { classId, fileId } = target;
  return [
    ...(fileId === null ? [] : [{ kind: 'form' as const, mode: 'class' as const, label: 'このファイルにクラスを追加' }]),
    { kind: 'form', mode: 'file', label: 'ファイルを追加' },
    ...(classId === null ? [] : [{ kind: 'form' as const, mode: 'renameClass' as const, label: 'クラスの名前を変更' }]),
    ...(fileId === null ? [] : [{ kind: 'form' as const, mode: 'renameFile' as const, label: 'ファイルの名前を変更' }]),
    ...(classId === null ? [] : [{ kind: 'form' as const, mode: 'setSuperclass' as const, label: '継承元を設定' }]),
    ...(classId === null ? [] : [{ kind: 'form' as const, mode: 'setInterface' as const, label: '実装するインターフェースを設定' }]),
    // 確認ダイアログは出さない。誤って消してもCtrl+Zの取り消し履歴で戻せる
    ...(classId === null
      ? []
      : [
          {
            kind: 'action' as const,
            label: 'クラスを削除',
            run: () => {
              deleteClass(classId);
              onClose();
            },
          },
        ]),
    ...(fileId === null
      ? []
      : [
          {
            kind: 'action' as const,
            label: 'ファイルを削除',
            run: () => {
              deleteFile(fileId);
              onClose();
            },
          },
        ]),
  ];
}

type MenuItemsProps = { items: readonly MenuItem[]; onSelectForm: (mode: FormMode) => void };

function MenuItems({ items, onSelectForm }: Readonly<MenuItemsProps>) {
  return (
    <div role="menu" aria-label="キャンバスのメニュー">
      {items.map((item, index) => (
        <button
          key={item.kind === 'form' ? item.mode : item.label}
          type="button"
          role="menuitem"
          autoFocus={index === 0}
          onClick={() => {
            if (item.kind === 'form') onSelectForm(item.mode);
            else item.run();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

type FormConfig = Omit<NameFormProps, 'onSubmit'> & { submit: (name: string) => boolean };

/** 選んだ項目の入力欄。名前の変更では今の名前を入れておく。 */
function useFormConfig(target: ContextMenuTarget, mode: FormMode): FormConfig | null {
  const codebase = useGameStore((state) => state.codebase);
  const { addClass, addFile, renameClass, renameFile, setSuperclass } = useGameStore.getState();
  const file = codebase.files.find((candidate) => candidate.id === target.fileId);
  const codeClass = findClass(codebase, target.classId ?? '');

  function classFormConfig(): FormConfig | null {
    if (mode === 'renameClass' && codeClass !== undefined) {
      return {
        label: '新しいクラス名',
        initialValue: codeClass.name,
        placeholder: 'クラス名',
        submitLabel: '変更',
        submit: (name) => renameClass(codeClass.id, name),
      };
    }
    if (mode === 'setSuperclass' && codeClass !== undefined) {
      return {
        label: '親クラス名(空で解除)',
        initialValue: findSuperclass(codebase, codeClass.id)?.name ?? '',
        placeholder: 'クラス名',
        submitLabel: '設定',
        options: availableSuperclasses(codebase, codeClass.id).map((candidate) => candidate.name),
        submit: (name) => setSuperclass(codeClass.id, name, 'extends'),
      };
    }
    if (mode === 'setInterface' && codeClass !== undefined) {
      return {
        label: 'インターフェース名(空で解除)',
        initialValue: findSuperclass(codebase, codeClass.id)?.name ?? '',
        placeholder: 'クラス名',
        submitLabel: '設定',
        options: availableSuperclasses(codebase, codeClass.id).map((candidate) => candidate.name),
        submit: (name) => setSuperclass(codeClass.id, name, 'implements'),
      };
    }
    return null;
  }

  function fileFormConfig(): FormConfig | null {
    if (mode === 'file') {
      return { label: '追加するファイルのパス', placeholder: 'src/foo/Foo.ts', submitLabel: '追加', submit: addFile };
    }
    if (mode === 'class' && file !== undefined) {
      return { label: '追加するクラス名', placeholder: 'クラス名', submitLabel: '追加', submit: (name) => addClass(file.id, name) };
    }
    if (mode === 'renameFile' && file !== undefined) {
      return {
        label: '新しいファイルのパス',
        initialValue: file.path,
        placeholder: 'src/foo/Foo.ts',
        submitLabel: '変更',
        submit: (path) => renameFile(file.id, path),
      };
    }
    return null;
  }

  return classFormConfig() ?? fileFormConfig();
}

type MenuFormProps = { target: ContextMenuTarget; mode: FormMode; onDone: () => void };

function MenuForm({ target, mode, onDone }: Readonly<MenuFormProps>) {
  const config = useFormConfig(target, mode);
  if (config === null) return null;
  const { submit, ...formProps } = config;
  // 失敗したとき(名前の重複など)は理由が画面に出るので、メニューを開いたまま直してもらう
  return (
    <NameForm
      {...formProps}
      onSubmit={(name) => {
        const done = submit(name);
        if (done) onDone();
        return done;
      }}
    />
  );
}

/** キャンバスの右クリックメニュー。クラス・ファイルの追加と名前の変更を、その場で名前を入れて行う。 */
export function CanvasContextMenu({ target, onClose }: Readonly<{ target: ContextMenuTarget; onClose: () => void }>) {
  const file = useGameStore((state) => state.codebase.files.find((candidate) => candidate.id === target.fileId));
  const [mode, setMode] = useState<Mode>('menu');
  const menuRef = useRef<HTMLDivElement>(null);

  useCloseOnOutside(menuRef, onClose);

  // ponytail: 画面端での位置補正はしていない。右下端ではみ出すと分かったらビューポートに収める
  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left: target.x, top: target.y }} data-testid="context-menu">
      {file === undefined ? null : <div className="context-menu__caption">{file.path}</div>}
      {mode === 'menu' ? (
        <MenuItems items={menuItemsFor(target, onClose)} onSelectForm={setMode} />
      ) : (
        <MenuForm target={target} mode={mode} onDone={onClose} />
      )}
    </div>,
    document.body,
  );
}
