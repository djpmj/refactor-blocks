import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject, type SubmitEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { findClass, findField, findMethod, findSuperclass, type Codebase } from '../../domain/codebase/Codebase';
import { moveMethodTargets } from '../../domain/codebase/moveMethod';
import { moveFieldTargets } from '../../domain/codebase/moveField';
import { moveClassTargets } from '../../domain/codebase/moveClass';
import { fileLabels } from './fileLabels';
import { availableParents, implementableInterfaces } from '../../domain/codebase/setSuperclass';
import { useGameStore, useGameStoreApi, type GameStore } from '../store/useGameStore';
import { clampMenuPosition, type Point } from './clampMenuPosition';
import type { ContextMenuTarget } from './useCanvasContextMenu';
import { contextMenuGroups, type MenuGroup } from './contextMenuGroups';

type Mode = 'menu' | 'class' | 'renameClass';
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
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            flushSync(() => setOpen(true));
          }
        }}
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
  const moveMethodToNewClass = useGameStore((state) => state.moveMethodToNewClass);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const position = useSubmenuPosition(triggerRef, submenuRef, open);
  const member = target.member;
  if (member === null) return null;
  const candidates = member.kind === 'method' ? moveMethodTargets(codebase, member.id) : moveFieldTargets(codebase, member.id);
  if (candidates.length === 0 && member.kind !== 'method') return null;
  const select = (classId: string) => {
    if (member.kind === 'method') moveMethod(member.id, classId);
    else moveField(member.id, classId);
    onClose();
  };
  return (
    <SubmenuTrigger label={label} open={open} setOpen={setOpen} wrapperRef={wrapperRef} triggerRef={triggerRef}>
      <div ref={submenuRef} role="menu" aria-label={label} className="context-menu context-menu__submenu" style={{ left: position.x, top: position.y }}>
        {member.kind === 'method' ? (
          <>
            <button type="button" role="menuitem" onClick={() => { moveMethodToNewClass(member.id); onClose(); }}>新しいクラスへ</button>
            {candidates.length > 0 ? <div role="separator" className="context-menu__separator" /> : null}
          </>
        ) : null}
        {candidates.map((candidate) => (
          <button key={candidate.id} type="button" role="menuitem" onClick={() => select(candidate.id)}>
            {candidate.name}
          </button>
        ))}
      </div>
    </SubmenuTrigger>
  );
}

function MoveClassMenuItem({ target, label, onClose }: Readonly<ExtendsMenuItemProps>) {
  const codebase = useGameStore((state) => state.codebase);
  const { moveClass } = useGameStoreApi().getState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const position = useSubmenuPosition(triggerRef, submenuRef, open);
  const classId = target.classId;
  if (classId === null) return null;
  const labels = new Map(fileLabels(codebase).map(({ id, label: name }) => [id, name]));
  const candidates = moveClassTargets(codebase, classId);
  if (candidates.length === 0) return null;
  const select = (fileId: string) => {
    moveClass(classId, fileId);
    onClose();
  };

  return (
    <SubmenuTrigger label={label} open={open} setOpen={setOpen} wrapperRef={wrapperRef} triggerRef={triggerRef}>
      <div ref={submenuRef} role="menu" aria-label={label} className="context-menu context-menu__submenu" style={{ left: position.x, top: position.y }}>
        {candidates.map((candidate) => (
          <button key={candidate.id} type="button" role="menuitem" onClick={() => select(candidate.id)}>
            {labels.get(candidate.id)}
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
 * 候補はインターフェース役のクラスだけ。継承元(extends)になっている相手は除く。無いときは押せない説明の項目を出す。
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
  const candidates = implementableInterfaces(codebase, codeClass.id).filter((candidate) => candidate.id !== codeClass.superclassId);

  return (
    <SubmenuTrigger label={label} open={open} setOpen={setOpen} wrapperRef={wrapperRef} triggerRef={triggerRef}>
      <div ref={submenuRef} role="menu" aria-label={label} className="context-menu context-menu__submenu" style={{ left: position.x, top: position.y }}>
        {candidates.length === 0 ? (
          <button type="button" role="menuitem" disabled>
            インターフェース役のクラスがありません(中身の無い public メソッドだけのクラス)
          </button>
        ) : null}
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

type MenuItemsProps = { target: ContextMenuTarget; onSelectForm: (mode: FormMode) => void; onClose: () => void; api: GameStore };

function memberName(target: ContextMenuTarget, codebase: Codebase): string | undefined {
  if (target.member?.kind === 'method') return findMethod(codebase, target.member.id)?.name;
  if (target.member?.kind === 'field') return findField(codebase, target.member.id)?.name;
  return undefined;
}

function focusSubmenuItem(activeItem: Element | null): boolean {
  if (activeItem === null) return false;
  const wrapper = activeItem.closest('.context-menu__submenu-wrapper');
  const firstSubmenuItem = wrapper?.querySelector<HTMLElement>('[role="menu"] [role="menuitem"]');
  if (firstSubmenuItem === null || firstSubmenuItem === undefined) return false;
  firstSubmenuItem.focus();
  return true;
}

function focusAdjacentMenuItem(menuRef: RefObject<HTMLDivElement | null>, backward: boolean): void {
  const menu = menuRef.current;
  const activeItem = document.activeElement;
  if (activeItem === null) return;
  const activeWrapper = activeItem.closest('.context-menu__submenu-wrapper');
  const openedSubmenu = activeItem.getAttribute('aria-expanded') === 'true'
    ? activeWrapper?.querySelector<HTMLElement>('.context-menu__submenu') ?? null
    : null;
  const activeSubmenu = activeItem.closest('.context-menu__submenu');
  const menuRoot = openedSubmenu ?? activeSubmenu ?? menu;
  const menuItems = [...(menuRoot?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    .filter((item) => item.closest('.context-menu__submenu') === (openedSubmenu ?? activeSubmenu));
  if (menuItems.length === 0) return;
  const index = menuItems.findIndex((item) => item === activeItem);
  const next = backward ? (index - 1 + menuItems.length) % menuItems.length : (index + 1) % menuItems.length;
  menuItems[next]?.focus();
}

function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, menuRef: RefObject<HTMLDivElement | null>): void {
  if (event.key === 'ArrowRight') {
    if (focusSubmenuItem(document.activeElement)) event.preventDefault();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  focusAdjacentMenuItem(menuRef, event.key === 'ArrowUp');
}

function useTabNavigation(menuRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const moveFocusWithTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      focusAdjacentMenuItem(menuRef, event.shiftKey);
    };
    document.addEventListener('keydown', moveFocusWithTab, true);
    return () => document.removeEventListener('keydown', moveFocusWithTab, true);
  }, [menuRef]);
}

function MenuGroupItems({ group, target, onSelectForm, onClose, api }: MenuItemsProps & { group: MenuGroup }) {
  return <div role="group" aria-label={group.heading} className="context-menu__group">
    <div role="presentation" className="context-menu__heading">{group.heading}</div>
    {group.items.map((item) => {
      if (item.kind === 'move-class-submenu') return <MoveClassMenuItem key={item.kind} target={target} label={item.label} onClose={onClose} />;
      if (item.kind === 'move-submenu') return <MoveMenuItem key={item.kind} target={target} label={item.label} onClose={onClose} />;
      if (item.kind === 'extends-submenu') return <ExtendsMenuItem key={item.kind} target={target} label={item.label} onClose={onClose} />;
      if (item.kind === 'implements-submenu') return <ImplementsMenuItem key={item.kind} target={target} label={item.label} />;
      if (item.kind === 'action') return <button key={item.action} type="button" role="menuitem" className={item.action.startsWith('delete') ? 'context-menu__danger' : undefined} onClick={() => {
        if (item.action === 'addFile') api.getState().addFile();
        if (item.action === 'moveClassToNewFile' && target.classId !== null) {
          const classId = target.classId;
          onClose();
          if (api.getState().moveClassToNewFile(classId) !== null) {
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="class-header-${CSS.escape(findClass(api.getState().codebase, classId)?.name ?? '')}"]`)?.focus());
          }
          return;
        }
        if (item.action === 'deleteClass' && target.classId !== null) api.getState().deleteClass(target.classId);
        if (item.action === 'deleteFile' && target.fileId !== null) api.getState().deleteFile(target.fileId);
        onClose();
      }}>{item.label}</button>;
      return <button key={item.mode} type="button" role="menuitem" onClick={() => onSelectForm(item.mode)}>{item.label}</button>;
    })}
  </div>;
}

function MenuItems({ target, onSelectForm, onClose, api }: Readonly<MenuItemsProps>) {
  const menuRef = useRef<HTMLDivElement>(null);
  useTabNavigation(menuRef);
  const codebase = useGameStore((state) => state.codebase);
  const canMoveClassToNewFile = target.classId !== null && codebase.files.some((file) =>
    file.classes.some((codeClass) => codeClass.id === target.classId) && file.classes.length > 1,
  );
  const member = memberName(target, codebase);
  const className = target.classId === null ? undefined : findClass(codebase, target.classId)?.name;
  const groups = contextMenuGroups(target, { member, className }).filter((group) => {
    if (group.kind !== 'member' || target.member === null) return true;
    return target.member.kind === 'method' || moveFieldTargets(codebase, target.member.id).length > 0;
  });
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.kind !== 'action' || item.action !== 'moveClassToNewFile' || canMoveClassToNewFile),
  }));
  useLayoutEffect(() => {
    // nullを返す項目を飛ばし、実際に描画された先頭項目にフォーカスする。
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [target]);
  return (
    <div ref={menuRef} role="menu" aria-label="キャンバスのメニュー" onKeyDown={(event) => handleMenuKeyDown(event, menuRef)}>
      {visibleGroups.map((group, groupIndex) => (
        <Fragment key={group.kind}>
        {groupIndex > 0 ? <div role="separator" className="context-menu__separator" /> : null}
        <MenuGroupItems group={group} target={target} onSelectForm={onSelectForm} onClose={onClose} api={api} />
        </Fragment>
      ))}
    </div>
  );
}

type FormConfig = Omit<NameFormProps, 'onSubmit'> & { submit: (name: string) => boolean };

/** 選んだ項目の入力欄。名前の変更では今の名前を入れておく。 */
function useFormConfig(target: ContextMenuTarget, mode: FormMode): FormConfig | null {
  const codebase = useGameStore((state) => state.codebase);
  const { addClass, renameClass } = useGameStoreApi().getState();
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
    if (mode === 'class' && file !== undefined) {
      return { label: '追加するクラス名', placeholder: 'クラス名', submitLabel: '追加', submit: (name) => addClass(file.id, name) };
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
  const api = useGameStoreApi();
  const [mode, setMode] = useState<Mode>('menu');
  const menuRef = useRef<HTMLDivElement>(null);

  useCloseOnOutside(menuRef, onDismiss);
  const position = usePositionWithinViewport(menuRef, target.x, target.y, mode);

  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left: position.x, top: position.y }} data-testid="context-menu">
      {mode === 'menu' ? (
        <MenuItems target={target} onSelectForm={setMode} onClose={onClose} api={api} />
      ) : (
        <MenuForm target={target} mode={mode} onDone={onClose} />
      )}
    </div>,
    document.body,
  );
}
