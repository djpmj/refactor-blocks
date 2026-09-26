import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type SubmitEvent } from 'react';
import { createPortal } from 'react-dom';
import { findClass, findSuperclass } from '../../domain/codebase/Codebase';
import { moveMethodTargets } from '../../domain/codebase/moveMethod';
import { moveFieldTargets } from '../../domain/codebase/moveField';
import { availableParents } from '../../domain/codebase/setSuperclass';
import { useGameStore, useGameStoreApi, type GameStore } from '../store/useGameStore';
import { clampMenuPosition, type Point } from './clampMenuPosition';
import type { ContextMenuTarget } from './useCanvasContextMenu';

type Mode = 'menu' | 'class' | 'file' | 'renameClass' | 'renameFile';
type FormMode = Exclude<Mode, 'menu'>;

type NameFormProps = {
  label: string;
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => boolean;
};

function NameForm({ label, initialValue = '', placeholder, submitLabel, onSubmit }: Readonly<NameFormProps>) {
  const [name, setName] = useState(initialValue);
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
        onFocus={(event) => {
          event.target.select();
        }}
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

/** クリック位置に描画したあと、実際の大きさを測ってビューポートからはみ出さない位置へ補正する。ペイント前に補正するのでちらつかない。 */
function usePositionWithinViewport(menuRef: RefObject<HTMLElement | null>, x: number, y: number, watch: unknown) {
  const [position, setPosition] = useState<Point>({ x, y });
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition(clampMenuPosition({ x, y }, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [menuRef, x, y, watch]);
  return position;
}

type MenuItem =
  | { kind: 'form'; mode: FormMode; label: string }
  | { kind: 'action'; run: () => void; label: string }
  | { kind: 'move-submenu'; label: string }
  | { kind: 'extends-submenu'; label: string }
  | { kind: 'implements-submenu'; label: string };

/** 右クリックした場所で使える項目。クラスの上ならクラス、ファイルの上ならファイルに対する項目が増える。 */
function menuItemsFor(target: ContextMenuTarget, onClose: () => void, api: GameStore): MenuItem[] {
  const { deleteClass, deleteFile } = api.getState();
  const { classId, fileId } = target;
  const moveItems: MenuItem[] = target.member === null ? [] : [{ kind: 'move-submenu', label: '別のクラスへ移動' }];
  return [
    ...moveItems,
    ...(fileId === null ? [] : [{ kind: 'form' as const, mode: 'class' as const, label: 'このファイルにクラスを追加' }]),
    { kind: 'form', mode: 'file', label: 'ファイルを追加' },
    ...(classId === null ? [] : [{ kind: 'form' as const, mode: 'renameClass' as const, label: 'クラスの名前を変更' }]),
    ...(fileId === null ? [] : [{ kind: 'form' as const, mode: 'renameFile' as const, label: 'ファイルの名前を変更' }]),
    ...(classId === null ? [] : [{ kind: 'extends-submenu' as const, label: '継承元を設定' }]),
    ...(classId === null ? [] : [{ kind: 'implements-submenu' as const, label: '実装するインターフェースを設定' }]),
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

/** トリガー要素の右側にサブメニューを出す。開いた瞬間のトリガーの位置から計算し、ビューポートからははみ出さない。 */
function useSubmenuPosition(triggerRef: RefObject<HTMLElement | null>, submenuRef: RefObject<HTMLElement | null>, open: boolean): Point {
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const submenu = submenuRef.current;
    if (!open || trigger === null || submenu === null) return;
    const anchor = trigger.getBoundingClientRect();
    const { width, height } = submenu.getBoundingClientRect();
    setPosition(clampMenuPosition({ x: anchor.right, y: anchor.top }, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [triggerRef, submenuRef, open]);
  return position;
}

type SubmenuTriggerProps = {
  label: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
};

/** ホバー(またはフォーカス)すると候補を右側に出すサブメニューの見た目の共通部分。 */
function SubmenuTrigger({ label, open, setOpen, wrapperRef, triggerRef, children }: Readonly<SubmenuTriggerProps>) {
  return (
    <div
      ref={wrapperRef}
      className="context-menu__submenu-wrapper"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !wrapperRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          // ホバーで既に開いていることがあるので、開閉のトグルにはしない(トグルだとホバー直後のクリックで閉じてしまう)
          setOpen(true);
        }}
      >
        {label}
      </button>
      {open ? children : null}
    </div>
  );
}

type ExtendsMenuItemProps = { target: ContextMenuTarget; label: string; onClose: () => void };

/**
 * 「継承元を設定」の項目。候補をクリックすればその場で決まり、メニューを閉じる(1クラスに1つしか持てないため)。
 * 候補から、すでに実装先(implements)になっている相手を除く。
 */
function ExtendsMenuItem({ target, label, onClose }: Readonly<ExtendsMenuItemProps>) {
  const codebase = useGameStore((state) => state.codebase);
  const { setSuperclass } = useGameStoreApi().getState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const position = useSubmenuPosition(triggerRef, submenuRef, open);
  const codeClass = findClass(codebase, target.classId ?? '');
  if (codeClass === undefined) return null;

  const select = (name: string) => {
    if (setSuperclass(codeClass.id, name)) onClose();
  };
  const currentName = findSuperclass(codebase, codeClass.id)?.name ?? '';
  const interfaceIds = new Set(codeClass.interfaceIds ?? []);
  const candidates = availableParents(codebase, codeClass.id)
    .filter((candidate) => !interfaceIds.has(candidate.id))
    .map((candidate) => candidate.name);

  return (
    <SubmenuTrigger label={label} open={open} setOpen={setOpen} wrapperRef={wrapperRef} triggerRef={triggerRef}>
      <div ref={submenuRef} role="menu" aria-label={label} className="context-menu context-menu__submenu" style={{ left: position.x, top: position.y }}>
        <button type="button" role="menuitem" aria-current={currentName === ''} onClick={() => select('')}>
          (解除)
        </button>
        {candidates.map((name) => (
          <button key={name} type="button" role="menuitem" aria-current={name === currentName} onClick={() => select(name)}>
            {name}
          </button>
        ))}
      </div>
    </SubmenuTrigger>
  );
}

function MoveMenuItem({ target, label, onClose }: Readonly<ExtendsMenuItemProps>) {
  const codebase = useGameStore((state) => state.codebase);
  const { moveMethod, moveField } = useGameStoreApi().getState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const position = useSubmenuPosition(triggerRef, submenuRef, open);
  const member = target.member;
  if (member === null) return null;
  const candidates = member.kind === 'method' ? moveMethodTargets(codebase, member.id) : moveFieldTargets(codebase, member.id);
  if (candidates.length === 0) return null;
  const select = (classId: string) => {
    if (member.kind === 'method') moveMethod(member.id, classId);
    else moveField(member.id, classId);
    onClose();
  };
  return (
    <SubmenuTrigger label={label} open={open} setOpen={setOpen} wrapperRef={wrapperRef} triggerRef={triggerRef}>
      <div ref={submenuRef} role="menu" aria-label={label} className="context-menu context-menu__submenu" style={{ left: position.x, top: position.y }}>
        {candidates.map((candidate) => (
          <button key={candidate.id} type="button" role="menuitem" onClick={() => select(candidate.id)}>
            {candidate.name}
          </button>
        ))}
      </div>
    </SubmenuTrigger>
  );
}

type ImplementsMenuItemProps = { target: ContextMenuTarget; label: string };

/**
 * 「実装するインターフェースを設定」の項目。チェック式(menuitemcheckbox)で、複数選べる。
 * 押しても閉じず、続けて別のインターフェースを付け外しできる(Esc・外側クリックで閉じる)。
 * 候補から、継承元(extends)になっている相手を除く。
 */
function ImplementsMenuItem({ target, label }: Readonly<ImplementsMenuItemProps>) {
  const codebase = useGameStore((state) => state.codebase);
  const { addInterface, removeInterface } = useGameStoreApi().getState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const position = useSubmenuPosition(triggerRef, submenuRef, open);
  const codeClass = findClass(codebase, target.classId ?? '');
  if (codeClass === undefined) return null;

  const implementedIds = new Set(codeClass.interfaceIds ?? []);
  const candidates = availableParents(codebase, codeClass.id).filter((candidate) => candidate.id !== codeClass.superclassId);

  return (
    <SubmenuTrigger label={label} open={open} setOpen={setOpen} wrapperRef={wrapperRef} triggerRef={triggerRef}>
      <div ref={submenuRef} role="menu" aria-label={label} className="context-menu context-menu__submenu" style={{ left: position.x, top: position.y }}>
        {candidates.map((candidate) => {
          const checked = implementedIds.has(candidate.id);
          return (
            <button
              key={candidate.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              className={checked ? 'context-menu__checkbox context-menu__checkbox--checked' : 'context-menu__checkbox'}
              onClick={() => {
                if (checked) removeInterface(codeClass.id, candidate.name);
                else addInterface(codeClass.id, candidate.name);
              }}
            >
              {checked ? '✓ ' : ''}
              {candidate.name}
            </button>
          );
        })}
      </div>
    </SubmenuTrigger>
  );
}

type MenuItemsProps = { items: readonly MenuItem[]; target: ContextMenuTarget; onSelectForm: (mode: FormMode) => void; onClose: () => void };

function MenuItems({ items, target, onSelectForm, onClose }: Readonly<MenuItemsProps>) {
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // nullを返す項目を飛ばし、実際に描画された先頭項目にフォーカスする。
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [target]);
  return (
    <div ref={menuRef} role="menu" aria-label="キャンバスのメニュー">
      {items.map((item) => {
        if (item.kind === 'move-submenu') {
          return <MoveMenuItem key={item.kind} target={target} label={item.label} onClose={onClose} />;
        }
        if (item.kind === 'extends-submenu') {
          return <ExtendsMenuItem key={item.kind} target={target} label={item.label} onClose={onClose} />;
        }
        if (item.kind === 'implements-submenu') {
          return <ImplementsMenuItem key={item.kind} target={target} label={item.label} />;
        }
        return (
          <button
            key={item.kind === 'form' ? item.mode : item.label}
            type="button"
            role="menuitem"
            onClick={() => {
              if (item.kind === 'form') onSelectForm(item.mode);
              else item.run();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

type FormConfig = Omit<NameFormProps, 'onSubmit'> & { submit: (name: string) => boolean };

/** 選んだ項目の入力欄。名前の変更では今の名前を入れておく。 */
function useFormConfig(target: ContextMenuTarget, mode: FormMode): FormConfig | null {
  const codebase = useGameStore((state) => state.codebase);
  const { addClass, addFile, renameClass, renameFile } = useGameStoreApi().getState();
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
export function CanvasContextMenu({ target, onClose, onDismiss }: Readonly<{ target: ContextMenuTarget; onClose: () => void; onDismiss: () => void }>) {
  const file = useGameStore((state) => state.codebase.files.find((candidate) => candidate.id === target.fileId));
  const api = useGameStoreApi();
  const [mode, setMode] = useState<Mode>('menu');
  const menuRef = useRef<HTMLDivElement>(null);

  useCloseOnOutside(menuRef, onDismiss);
  const position = usePositionWithinViewport(menuRef, target.x, target.y, mode);

  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left: position.x, top: position.y }} data-testid="context-menu">
      {file === undefined ? null : <div className="context-menu__caption">{file.path}</div>}
      {mode === 'menu' ? (
        <MenuItems items={menuItemsFor(target, onClose, api)} target={target} onSelectForm={setMode} onClose={onClose} />
      ) : (
        <MenuForm target={target} mode={mode} onDone={onClose} />
      )}
    </div>,
    document.body,
  );
}
