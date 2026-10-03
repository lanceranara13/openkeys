import { useCallback, useEffect, useRef, useState } from 'react';
import { createBackup, readBackup } from '../core/backup';
import { deviceKey, parseDefinition, type KeyboardDefinition } from '../core/definition';
import { KC_NO, KC_TRNS } from '../core/keycodes';
import { valueSize, type MenuControl } from '../core/menus';
import { findDefinition, loadBundled, rememberDefinition } from '../core/registry';
import { createDemoTransport, demoDefinition } from '../demo';
import { createDriver, hidFilters } from '../drivers';
import type { DriverInfo, KeyboardDriver, Transport, TransportInfo } from '../drivers/types';
import { createVirtualTransport, VirtualKeyboard } from '../transports/virtual';
import { isWebHidSupported, openHidTransport, pickHidDevice } from '../transports/webhid';

export interface ReadySession {
  status: 'ready';
  device: TransportInfo;
  definition: KeyboardDefinition;
  info: DriverInfo;
  /** One list of keycodes per layer, indexed by `row * cols + col`. */
  keymap: number[][];
  /** Current bytes of every menu control the firmware answered for, by `ref.key`. */
  values: Record<string, number[]>;
  /** Chosen option per layout group. */
  layoutSelection: number[];
}

export type SessionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  /** A keyboard is open but no definition matches its USB ids. */
  | { status: 'needs-definition'; device: TransportInfo }
  | ReadySession;

export interface Notice {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

export type Session = ReturnType<typeof useSession>;

// Lighting values apply instantly; they are written to permanent storage once the
// user stops dragging.
const SAVE_DELAY_MS = 500;
const LAYOUT_STORAGE_KEY = 'openkeys:layout-options';

const allControls = (definition: KeyboardDefinition): MenuControl[] =>
  definition.menus.flatMap((menu) => menu.sections.flatMap((section) => section.controls));

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'The browser could not open the keyboard. Close other configurators (VIA, vendor software) and try again.';
  }
  return error instanceof Error ? error.message : String(error);
}

function readLayoutSelection(definition: KeyboardDefinition): number[] {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}');
    const selection = stored[deviceKey(definition.vendorId, definition.productId)];
    return Array.isArray(selection) ? selection.map(Number) : [];
  } catch {
    // Unreadable or blocked storage: start from the default layout.
    return [];
  }
}

function storeLayoutSelection(definition: KeyboardDefinition, selection: number[]): void {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}');
    stored[deviceKey(definition.vendorId, definition.productId)] = selection;
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The choice still applies until the page is closed.
  }
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Owns the connection to one keyboard and everything read from it. */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'idle' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const stateRef = useRef(state);
  const transportRef = useRef<Transport | null>(null);
  const driverRef = useRef<KeyboardDriver | null>(null);
  const saveTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    setNotice({ id: Date.now(), kind, text });
  }, []);

  const release = useCallback(async () => {
    saveTimers.current.forEach(clearTimeout);
    saveTimers.current.clear();
    const transport = transportRef.current;
    transportRef.current = null;
    driverRef.current = null;
    // Closing a keyboard that is already gone fails; there is nothing left to do then.
    await transport?.close().catch(() => undefined);
  }, []);

  useEffect(() => () => void release(), [release]);

  /** Reads everything from an open keyboard and shows the configurator. */
  const start = useCallback(async (transport: Transport, definition: KeyboardDefinition) => {
    const driver = createDriver(transport, definition);
    const info = await driver.connect();
    const keymap = await driver.readKeymap();

    const values: Record<string, number[]> = {};
    if (info.supportsMenus) {
      for (const control of allControls(definition)) {
        const bytes = await driver.readValue(control.ref, valueSize(control));
        if (bytes) values[control.ref.key] = bytes;
      }
    }

    driverRef.current = driver;
    setState({
      status: 'ready',
      device: transport.info,
      definition,
      info,
      keymap,
      values,
      layoutSelection: readLayoutSelection(definition),
    });
  }, []);

  const open = useCallback(
    async (connect: () => Promise<{ transport: Transport; definition: KeyboardDefinition | null } | null>) => {
      await release();
      setState({ status: 'connecting' });
      try {
        const opened = await connect();
        if (!opened) {
          setState({ status: 'idle' });
          return;
        }
        const { transport, definition } = opened;
        transport.onDisconnect(() => {
          if (transportRef.current !== transport) return;
          void release();
          setState({ status: 'idle' });
          notify('error', `${transport.info.name} was unplugged.`);
        });

        if (definition) await start(transport, definition);
        else setState({ status: 'needs-definition', device: transport.info });
      } catch (error) {
        await release();
        setState({ status: 'idle' });
        notify('error', describeError(error));
      }
    },
    [notify, release, start],
  );

  /** Opens the browser's device picker and connects to the chosen keyboard. */
  const connect = useCallback(
    () =>
      open(async () => {
        // Without WebHID there is no picker to open; the connect panel explains why.
        if (!isWebHidSupported()) return null;
        const device = await pickHidDevice(hidFilters);
        if (!device) return null;
        const transport = await openHidTransport(device);
        transportRef.current = transport;
        const { vendorId, productId } = transport.info;
        return { transport, definition: await findDefinition(vendorId, productId) };
      }),
    [open],
  );

  const connectDemo = useCallback(
    () =>
      open(async () => {
        const transport = createDemoTransport();
        transportRef.current = transport;
        return { transport, definition: demoDefinition };
      }),
    [open],
  );

  /** Opens a virtual copy of a bundled keyboard, to look at it without owning one. */
  const connectPreview = useCallback(
    (path: string) =>
      open(async () => {
        const definition = await loadBundled(path);
        const { rows, cols } = definition.matrix;
        const blank = (keycode: number) => Array<number>(rows * cols).fill(keycode);
        const keyboard = new VirtualKeyboard({
          rows,
          cols,
          layers: [blank(KC_NO), blank(KC_TRNS), blank(KC_TRNS), blank(KC_TRNS)],
          acceptAnyValue: true,
        });
        const transport = createVirtualTransport(keyboard, {
          name: definition.name,
          vendorId: definition.vendorId,
          productId: definition.productId,
        });
        transportRef.current = transport;
        return { transport, definition };
      }),
    [open],
  );

  const disconnect = useCallback(async () => {
    await release();
    setState({ status: 'idle' });
  }, [release]);

  /** Takes a definition file from the user, for a keyboard that is not bundled. */
  const provideDefinition = useCallback(
    async (file: File) => {
      try {
        let raw: unknown;
        try {
          raw = JSON.parse(await file.text());
        } catch {
          throw new Error(`${file.name} is not valid JSON.`);
        }
        const definition = parseDefinition(raw);
        const current = stateRef.current;
        const transport = transportRef.current;

        if (current.status !== 'needs-definition' || !transport) {
          rememberDefinition(raw, definition);
          notify('ok', `Saved "${definition.name}". Connect that keyboard to use it.`);
          return;
        }
        const { vendorId, productId } = current.device;
        if (definition.vendorId !== vendorId || definition.productId !== productId) {
          throw new Error(
            `That file is for "${definition.name}" (${deviceKey(definition.vendorId, definition.productId)}), ` +
              `but the connected keyboard is ${deviceKey(vendorId, productId)}.`,
          );
        }
        rememberDefinition(raw, definition);
        await start(transport, definition);
      } catch (error) {
        notify('error', describeError(error));
      }
    },
    [notify, start],
  );

  const patchKey = useCallback((layer: number, index: number, keycode: number) => {
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            keymap: current.keymap.map((keys, at) => (at === layer ? keys.with(index, keycode) : keys)),
          }
        : current,
    );
  }, []);

  /** Remaps one key. The keyboard stores it straight away. */
  const setKeycode = useCallback(
    async (layer: number, row: number, col: number, keycode: number) => {
      const current = stateRef.current;
      const driver = driverRef.current;
      if (current.status !== 'ready' || !driver) return;

      const index = row * current.definition.matrix.cols + col;
      const previous = current.keymap[layer][index];
      if (previous === keycode) return;

      patchKey(layer, index, keycode);
      try {
        await driver.setKeycode(layer, row, col, keycode);
      } catch (error) {
        patchKey(layer, index, previous);
        notify('error', describeError(error));
      }
    },
    [notify, patchKey],
  );

  /** Changes a lighting (or other menu) value. */
  const setValue = useCallback(
    async (control: MenuControl, bytes: number[]) => {
      const driver = driverRef.current;
      if (!driver) return;
      const { key, channel } = control.ref;

      setState((current) =>
        current.status === 'ready'
          ? { ...current, values: { ...current.values, [key]: bytes } }
          : current,
      );
      try {
        await driver.writeValue(control.ref, bytes);
        clearTimeout(saveTimers.current.get(channel));
        saveTimers.current.set(
          channel,
          setTimeout(() => {
            driver.saveValues(channel).catch((error: unknown) => notify('error', describeError(error)));
          }, SAVE_DELAY_MS),
        );
      } catch (error) {
        notify('error', describeError(error));
      }
    },
    [notify],
  );

  const setLayoutOption = useCallback((group: number, choice: number) => {
    const current = stateRef.current;
    if (current.status !== 'ready') return;
    const layoutSelection = [...current.layoutSelection];
    layoutSelection[group] = choice;
    storeLayoutSelection(current.definition, layoutSelection);
    setState((latest) => (latest.status === 'ready' ? { ...latest, layoutSelection } : latest));
  }, []);

  /** Runs a slow keyboard operation, then re-reads the keymap from the keyboard. */
  const rewrite = useCallback(
    async (operation: (driver: KeyboardDriver, session: ReadySession) => Promise<string>) => {
      const current = stateRef.current;
      const driver = driverRef.current;
      if (current.status !== 'ready' || !driver) return;

      setBusy(true);
      try {
        const done = await operation(driver, current);
        const keymap = await driver.readKeymap();
        setState((latest) => (latest.status === 'ready' ? { ...latest, keymap } : latest));
        notify('ok', done);
      } catch (error) {
        notify('error', describeError(error));
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );

  const resetKeymap = useCallback(
    () =>
      rewrite(async (driver) => {
        await driver.resetKeymap();
        return 'Keymap reset to the keyboard’s defaults.';
      }),
    [rewrite],
  );

  const importBackup = useCallback(
    (file: File) =>
      rewrite(async (driver, session) => {
        const { definition, info, keymap } = session;
        const layers = readBackup(await file.text(), definition, info.protocolVersion, info.layerCount);
        let changed = 0;
        for (const [layer, keys] of layers.entries()) {
          for (const [index, keycode] of keys.entries()) {
            if (keymap[layer][index] === keycode) continue;
            const row = Math.floor(index / definition.matrix.cols);
            await driver.setKeycode(layer, row, index % definition.matrix.cols, keycode);
            changed += 1;
          }
        }
        return changed === 0
          ? 'The keyboard already matches that backup.'
          : `Restored ${changed} key${changed === 1 ? '' : 's'} from the backup.`;
      }),
    [rewrite],
  );

  const exportBackup = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'ready') return;
    const backup = createBackup(current.definition, current.info.protocolVersion, current.keymap);
    const slug = current.definition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    download(`${slug}-keymap.json`, JSON.stringify(backup, null, 2));
  }, []);

  return {
    state,
    notice,
    busy,
    connect,
    connectDemo,
    connectPreview,
    disconnect,
    provideDefinition,
    setKeycode,
    setValue,
    setLayoutOption,
    resetKeymap,
    importBackup,
    exportBackup,
  };
}
