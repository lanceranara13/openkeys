# Adding a driver

A driver teaches OpenKeys a protocol. Keyboards that run QMK with VIA are covered by
`src/drivers/via.ts`. A keyboard with its own protocol needs a new driver, and nothing
outside `src/drivers/` has to change.

## The three layers

```
interface  ->  KeyboardDriver  ->  Transport  ->  keyboard
(src/components)  (src/drivers)   (src/transports)
```

- **Transport** moves raw reports. `webhid.ts` does it over WebHID, `virtual.ts` in memory.
- **Driver** turns "set this key" into the reports of one protocol.
- **Interface** only calls the driver. It draws whatever the definition and the driver
  report: layers, keycodes, menus.

## 1. Implement `KeyboardDriver`

Create `src/drivers/<name>.ts`. The interface is in `src/drivers/types.ts`:

| Method | Does |
| --- | --- |
| `connect()` | Handshake. Returns the protocol version, layer count and the keycodes the keyboard understands |
| `readKeymap()` | Every layer, as lists of keycodes indexed by `row * cols + col` |
| `setKeycode(layer, row, col, keycode)` | Remap one key |
| `resetKeymap()` | Back to factory defaults |
| `readValue(ref, size)` | Read one menu value. `null` if the keyboard does not have it |
| `writeValue(ref, bytes)` | Change one menu value |
| `saveValues(channel)` | Make written values permanent |

Keycodes are plain numbers. `connect()` returns a `KeycodeCatalog` that names them and
groups them for the picker. QMK-based protocols can reuse `createQmkCatalog`; anything else
builds its own catalog with the same three members (`groups`, `describe`, `parse`).

Export a `DriverModule`:

```ts
export const myDriver: DriverModule = {
  id: 'my-protocol',
  // What the browser's device picker should list for this protocol.
  filters: [{ vendorId: 0x1234, usagePage: 0xff00 }],
  create: (transport, definition) => new MyDriver(transport, definition),
};
```

### Magnetic switches

`connect()` also returns `analog`: an `AnalogSupport` object (in `src/drivers/types.ts`) on
keyboards whose magnetic switches the driver can configure, otherwise `null`. When it is
present the interface shows the **Switches** tab; nothing else has to be wired up.

`src/drivers/keychron-analog.ts` is the one implementation so far and shows the pattern:
ask the keyboard whether it has the feature, refuse when its matrix is not the one the
definition describes, then read and write settings in tenths of a millimetre.

## 2. Register it

In `src/drivers/index.ts`:

```ts
export const drivers: DriverModule[] = [viaDriver, myDriver];
```

## 3. Point keyboards at it

In each definition that uses the protocol:

```json
{ "name": "My Board", "protocol": "my-protocol", ... }
```

Definitions without `protocol` use `via`. `npm run check` fails for a definition that names
a driver that does not exist.

## 4. Test it without hardware

`tests/via.test.ts` shows the pattern: `VirtualKeyboard` in `src/transports/virtual.ts`
answers reports the way firmware does, and the real driver runs against it. Write the
same kind of emulator for your protocol, even a small one, so the driver is covered by
`npm run check`.
