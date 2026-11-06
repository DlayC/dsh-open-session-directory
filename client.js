/**
 * Client half of `dsh-open-session-folder`.
 *
 * Registers one row into the Session row's "..." menu
 * (`sidebar.workspaces.session.menu.item`): it resolves the Session's working
 * directory from the Session Controller list projection and hands that path to
 * the Host's `session/openWorkspacePath` endpoint, which opens it with the
 * operating system's file manager. The click never retains, resumes, or
 * activates the Session.
 */
window.__ModuleLoader__.load({
  id: 'dsh-open-session-folder',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    /** Locale namespace, also this package's menu-entry id. */
    const NS = 'dsh-open-session-folder';
    /** Session row "..." menu list slot. */
    const SLOT = 'sidebar.workspaces.session.menu.item';

    /**
     * Host menu primitive, resolved through the loader's baseline externals.
     * The local button below carries the same markup and tokens, so a package
     * that cannot resolve the primitive still renders one consistent row.
     */
    let MenuItemButton;
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
      if (primitives !== null && primitives !== undefined && typeof primitives.MenuItemButton === 'function') {
        MenuItemButton = primitives.MenuItemButton;
      }
    } catch {
      MenuItemButton = undefined;
    }

    const zh = {
      open: '在资源管理器中打开',
      opening: '正在打开…',
      noFolder: '这个会话还没有本地工作目录，没有可以打开的文件夹。',
      failed: '打不开这个会话的文件夹：',
    };

    const en = {
      open: 'Open in File Explorer',
      opening: 'Opening…',
      noFolder: 'This session has no working directory yet, so there is no folder to open.',
      failed: 'Could not open this session folder:',
    };

    const ROW_CSS = `
.dsh-osf-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-osf-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-osf-item:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-osf-item:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
.dsh-osf-notice {
  position: fixed;
  left: 50%;
  bottom: 88px;
  transform: translateX(-50%);
  max-width: min(520px, calc(100vw - 32px));
  padding: 10px 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  pointer-events: none;
  z-index: 60;
}
`;

    /**
     * Unwrap a Remote result: generated Client methods answer with the value or
     * with `{ ok: false, error }`; a plain value passes through.
     * @param result - the Remote response.
     * @returns the value, or undefined for a failure.
     */
    function unwrap(result) {
      if (result === null || result === undefined) return undefined;
      if (typeof result.ok === 'boolean') return result.ok ? result.value : undefined;
      return result;
    }

    /**
     * Read the failure message a Remote response carries.
     * @param result - the Remote response.
     * @returns the message, or undefined when the call succeeded.
     */
    function failureOf(result) {
      if (result === null || result === undefined) return undefined;
      if (result.ok !== false) return undefined;
      return result.error?.message ?? result.error?.code ?? 'unknown error';
    }

    /** Whether this deployment can hand a path to the OS file manager. */
    const availability = {
      known: false,
      openable: true,
      listeners: new Set(),
    };

    function publishOpenable(openable) {
      availability.known = true;
      availability.openable = openable === true;
      for (const listener of availability.listeners) listener();
    }

    function useOpenable() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1);
        availability.listeners.add(listener);
        return () => availability.listeners.delete(listener);
      }, []);
      return availability;
    }

    /** One transient frame-wide notice, owned by this package. */
    const notice = {
      text: '',
      listeners: new Set(),
      timer: undefined,
    };

    function publishNotice() {
      for (const listener of notice.listeners) listener();
    }

    function showNotice(text) {
      notice.text = text;
      publishNotice();
      if (notice.timer !== undefined) clearTimeout(notice.timer);
      notice.timer = setTimeout(() => {
        notice.timer = undefined;
        notice.text = '';
        publishNotice();
      }, 6000);
    }

    /** Coalesce the list read: a menu click needs one row, not one call per row. */
    let listAt = 0;
    let listPromise;

    function sessionRows(remote) {
      const now = Date.now();
      if (listPromise !== undefined && now - listAt < 5000) return listPromise;
      listAt = now;
      listPromise = Promise.resolve()
        .then(() => remote.list({}))
        .then((result) => {
          const failure = failureOf(result);
          if (failure !== undefined) throw new Error(failure);
          const value = unwrap(result);
          return Array.isArray(value?.items) ? value.items : [];
        })
        .catch((error) => {
          listPromise = undefined;
          throw error;
        });
      return listPromise;
    }

    /**
     * Open one Session's working folder.
     * @param remote - the Client `session` Remote namespace.
     * @param sessionId - Session whose folder the row belongs to.
     * @param t - bound translator for this package's namespace.
     */
    async function openFolder(remote, sessionId, t) {
      const rows = await sessionRows(remote);
      const row = rows.find((item) => item?.sessionId === sessionId);
      const path = typeof row?.cwd === 'string' && row.cwd !== '' ? row.cwd : undefined;
      if (path === undefined) {
        showNotice(t('noFolder'));
        return;
      }
      const result = await remote.openWorkspacePath({ path });
      const failure = failureOf(result);
      if (failure !== undefined) showNotice(`${t('failed')} ${failure}`);
    }

    /** One Session row's menu entry. */
    function OpenFolderRow(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const remote = props.transport?.sessionRemote;
      const state = useOpenable();
      const [busy, setBusy] = React.useState(false);

      // The menu's own open state, bound by the owner into this occurrence.
      const hook = props.useMenuOpenState;
      const pair = typeof hook === 'function' ? hook() : undefined;
      const setMenuOpen = Array.isArray(pair) ? pair[1] : undefined;

      if (state.known && !state.openable) return null;

      const select = () => {
        if (busy) return;
        if (typeof setMenuOpen === 'function') setMenuOpen(false);
        setBusy(true);
        void Promise.resolve()
          .then(() => openFolder(remote, props.sessionId, t))
          .catch((error) => showNotice(`${t('failed')} ${String(error?.message ?? error)}`))
          .finally(() => setBusy(false));
      };

      const label = busy ? t('opening') : t('open');
      return h(React.Fragment, null, [
        h('style', { key: 'style' }, ROW_CSS),
        MenuItemButton !== undefined
          ? h(MenuItemButton, { key: 'item', onSelect: select }, label)
          : h('button', {
            key: 'item',
            type: 'button',
            role: 'menuitem',
            className: 'dsh-osf-item',
            onClick: select,
          }, label),
      ]);
    }

    /** The package's single transient notice, rendered in the frame overlay. */
    function NoticeOverlay() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1);
        notice.listeners.add(listener);
        return () => notice.listeners.delete(listener);
      }, []);
      if (notice.text === '') return null;
      return h('div', { className: 'dsh-osf-notice', role: 'status', 'aria-live': 'polite' }, notice.text);
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'open-session-folder: dictionaries');
      const t = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : (key) => key;
      const transport = { sessionRemote: undefined };

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: `${NS}-notice`,
        order: 900,
      }, NoticeOverlay));

      ctx.inject(['remote', 'remote.session'], (owner) => {
        const remote = owner.remote?.session;
        if (remote === undefined || remote === null) return;
        transport.sessionRemote = remote;

        // Ask once whether this deployment owns a native opener. A deployment
        // without one hides the row instead of failing on every click.
        Promise.resolve()
          .then(() => remote.canOpenWorkspacePath())
          .then((result) => {
            const value = unwrap(result);
            publishOpenable(typeof value === 'boolean' ? value : true);
          })
          .catch(() => publishOpenable(true));

        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: NS,
          order: 425,
          locale: NS,
          label: () => t('open'),
          inject: () => ({ transport }),
        }, OpenFolderRow));
      });
    }

    return { apply, inject: ['slots', 'locale'] };
  },
});
