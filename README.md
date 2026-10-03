# OpenKeys

Configure your keyboard in the browser. Remap keys, edit layers and tune RGB on any
VIA-compatible keyboard, with nothing to install and no account.

- **Works over WebHID.** The page talks straight to the keyboard. No server, no tracking.
- **One file per keyboard.** Support for a board is a JSON file in [`keyboards/`](keyboards/),
  in the same format VIA uses, so 2,000+ existing definitions work as they are.
- **Demo keyboard built in.** Everything can be tried, and tested, without hardware.

## Use it

1. **Connect.** Plug the keyboard in, click **Connect keyboard**, pick it in the browser's list.
2. **Click a key.** Your layout appears on screen. Pick a layer, then click the key to change.
3. **Choose what it does.** Pick the new key. The keyboard stores it immediately.

Lighting lives in the **Lighting** tab. Backup, restore, layout options and reset live in the
**Keyboard** tab.

If your keyboard is not built in, the app asks for its VIA definition file (`.json`). Load it
once and it is remembered in that browser.

## Run it

Needs Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the address it prints in Chrome, Edge, Opera or Brave. No keyboard nearby? Click
**Try the demo**.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app locally |
| `npm run check` | Type check, lint and test. Run this before committing |
| `npm run build` | Build the static site into `dist/` |
| `npm run add-keyboard <name>` | Add a keyboard definition (see below) |

`dist/` is plain static files and can be hosted anywhere.

## Add a keyboard

```sh
npm run add-keyboard -- --search q1    # find it in the VIA collection
npm run add-keyboard keychron/q1       # copy its definitions into keyboards/
npm run check                          # validate
```

Or drop your own file into `keyboards/<brand>/<board>.json`. There is nothing to register:
the folder is scanned at build time. To see the result without the hardware, run
`npm run dev` and click the keyboard under **Supported keyboards**.

Step by step, with the file format: [docs/adding-a-keyboard.md](docs/adding-a-keyboard.md).

Keyboards that do not speak the VIA protocol need a driver:
[docs/adding-a-driver.md](docs/adding-a-driver.md).

## How it is built

```
keyboards/            one JSON definition per keyboard, picked up automatically
src/core/             definition parser, layout (KLE) parser, keycodes, menus, backups
src/drivers/          one driver per protocol. via.ts speaks QMK/VIA
src/transports/       webhid.ts for real keyboards, virtual.ts emulates firmware in memory
src/demo/             the demo keyboard
src/app/              connection state (useSession) and routing
src/components/       the interface
build/                Vite plugin that indexes keyboards/
tests/                unit tests, including one that validates every file in keyboards/
```

The interface only knows the `KeyboardDriver` interface in `src/drivers/types.ts`. Drivers
only know the `Transport` interface. That is what keeps new keyboards and new protocols
from touching interface code. The look of the app is described in [DESIGN.md](DESIGN.md).

## Good to know

- **Theme:** light and dark. The page follows your system until you use the switch in the
  header.
- **Browser:** WebHID exists in Chromium browsers on desktop. Firefox and Safari can only
  run the demo.
- **Secure origin:** browsers allow WebHID on `https://` and on `localhost` only.
- **Linux:** the browser needs access to the keyboard's `hidraw` device, which takes a udev
  rule (the same one VIA documents).
- **One app at a time:** close VIA or vendor software before connecting. Only one program
  can hold the keyboard.
- **Firmware:** the keyboard must run QMK with VIA enabled. Lighting controls need VIA
  protocol 11 or newer (QMK 0.19+). Older firmware still gets key remapping.

## Not there yet

- Macros
- Rotary encoder turn actions (an encoder's press can be remapped)
- "Keycode" and "button" controls inside custom menus

## Credits

OpenKeys is built on [QMK](https://github.com/qmk/qmk_firmware) and the
[VIA](https://github.com/the-via/keyboards) keyboard definitions, uses the
[Keyboard Layout Editor](https://github.com/ijprest/keyboard-layout-editor) layout format,
is set in [IBM Plex](https://github.com/IBM/plex) with [Lucide](https://github.com/lucide-icons/lucide)
icons, takes its design reference from
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md) and its idea from
[OpenMouse](https://github.com/OpenMouse-Project/openmouse).

[CREDITS.md](CREDITS.md) lists every source, its license and exactly what was taken from it.
When you copy from or closely follow another project, add it there.

## License

OpenKeys is free software, released under the GNU General Public License, version 3.
You may use, change and share it, as long as what you share stays under the same license
and comes with its source. It comes with no warranty. The full text is in
[LICENSE](LICENSE).

Copyright (C) 2026 OpenKeys contributors.

The definitions in `keyboards/` are copied from
[the-via/keyboards](https://github.com/the-via/keyboards). They keep their own GPL-3.0
license and their authors' copyright.

OpenKeys is not affiliated with VIA, QMK or any keyboard maker.
