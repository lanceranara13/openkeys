# OpenKeys

Configure your keyboard in the browser. Remap keys, edit layers and tune RGB on any
VIA-compatible keyboard, with nothing to install and no account.

- **Works over WebHID.** The page talks straight to the keyboard. No server, no tracking.
- **One file per keyboard.** Support for a board is a JSON file in [`keyboards/`](keyboards/),
  in the same format VIA uses. More than 2,300 keyboards from 600 brands are built in.
- **Demo keyboard built in.** Everything can be tried, and tested, without hardware.

## Use it

1. **Connect.** Plug the keyboard in, click **Connect keyboard**, pick it in the browser's list.
2. **Click a key.** Your layout appears on screen. Pick a layer, then click the key to change.
3. **Choose what it does.** Pick the new key. The keyboard stores it immediately.

Lighting lives in the **Lighting** tab. Backup, restore, layout options and reset live in the
**Keyboard** tab.

Keyboards with magnetic (Hall effect) switches also get a **Switches** tab: actuation point
and rapid trigger, for all keys or key by key. See "Good to know" for which keyboards.

If your keyboard is not built in, open **Keyboards** and click **Try a definition file** with
its VIA definition (`.json`). It is remembered in that browser.

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
| `npm run add-keyboard <name>` | Find a keyboard, add it and check it (see below) |

`dist/` is plain static files and can be hosted anywhere.

## Add a keyboard

No terminal needed. Check the file on the **Keyboards** page with **Try a definition file**,
then drop it into the
[Add a keyboard](https://github.com/lanceranara13/openkeys/issues/new?template=add-keyboard.yml)
form on GitHub. A maintainer adds it. The **Contribute** page in the app walks through it.

With git, one command finds the keyboard in the VIA collection, copies its file into
`keyboards/` and checks it:

```sh
npm run add-keyboard q1
```

Have the file from the maker instead?

```sh
npm run add-keyboard ./my-board.json
```

Then `npm run dev`, open **Keyboards** and click it to see it. Nothing else needs editing.

- Every way to help: [CONTRIBUTING.md](CONTRIBUTING.md)
- Step by step: [docs/adding-a-keyboard.md](docs/adding-a-keyboard.md)
- Writing a definition from scratch: [docs/definition-format.md](docs/definition-format.md)
- Keyboards that do not speak VIA need a driver: [docs/adding-a-driver.md](docs/adding-a-driver.md)

## How it is built

```
keyboards/            one JSON definition per keyboard, picked up automatically
src/core/             definition parser, layout (KLE) parser, keycodes, menus, backups
scripts/              add-keyboard.mjs copies a VIA definition into keyboards/,
                      import-royal-kludge.mjs builds the Royal Kludge ones
src/drivers/          one driver per protocol. via.ts speaks QMK/VIA,
                      keychron-analog.ts adds Keychron's magnetic switch commands,
                      yichip.ts speaks Akko's own protocol,
                      royal-kludge.ts speaks Royal Kludge's
src/transports/       webhid.ts for real keyboards, virtual*.ts emulate firmware in memory
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
- **Firmware:** a VIA keyboard must run QMK with VIA enabled. Lighting controls need VIA
  protocol 11 or newer (QMK 0.19+). Older firmware still gets key remapping.
- **Magnetic switches:** the Switches tab works with Keychron HE and Lemokey HE keyboards;
  36 of them are built in. It is written from Keychron's published firmware and tested
  against an emulator of it, **not yet on real hardware**, so treat it as experimental.
  "Reset switches" restores factory settings. Keyboards that keep these settings in VIA
  menus (keyboard-wide, not per key) show them as ordinary tabs.
- **Akko (non-VIA):** the Akko 5075B Plus works through a second driver
  (`src/drivers/yichip.ts`) for RongYuan's YiChip firmware. Its commands were checked on
  the real keyboard: it is recognised, its base layer is shown and keys can be remapped,
  to media keys too. "Reset keymap" puts the keys back to the defaults listed in the
  definition file; that part is tested against an emulator only. Not yet: the Fn layer,
  lighting, macros, and the 2.4G dongle (connect by cable). Other models on the same
  firmware need only a definition file with their `deviceId` and default keys.
- **Royal Kludge (non-VIA):** 139 models that are configured with the "RK Keyboard"
  Windows software (USB vendor `258A`) work through a third driver
  (`src/drivers/royal-kludge.ts`): key remapping on the base layer, and the lighting
  effect, brightness, speed, colour and sleep time. Two things to know:
  - These keyboards **cannot be read**. OpenKeys shows the keys a model shipped with, or
    what it last stored from the same browser, and a change sends every key again. That
    replaces remapping done with other software. "Reset keymap" sends the defaults.
  - It is **experimental**. The bytes are the ones [Rangoli](https://github.com/rnayabed/rangoli)
    and [Kludge Knight](https://github.com/vinc3m1/kludgeknight) send, and the key
    positions come from the vendor's own configuration files, but OpenKeys has not tried
    them on a real keyboard. Rangoli lists four models as confirmed and most as "should
    work". Left out: four models Rangoli reports as broken, and about 50 newer ones (S98,
    S85, M87, M65, M70, L75, L98, R98 Pro, RK F75 and relatives) whose files use codes no
    open project has confirmed. Not yet: the Fn layer, per-key colours, macros. Rangoli
    notes that Royal Kludge models with another vendor id, such as `0C45`, use a
    different protocol; those are not covered.
- **Other brands:** a keyboard works when it runs QMK with VIA, whatever the brand. The
  whole VIA collection is built in, plus Keychron's, Lemokey's and NuPhy's own files. A
  QMK/VIA model that is not listed (Epomaker, Womier, the QMK models of Royal Kludge)
  works with the VIA file from its maker: open **Keyboards** and click **Try a definition
  file**. Magnetic models of Akko, MonsGeek, Epomaker, Womier and DrunkDeer run a related
  firmware that numbers its commands differently; it has no driver yet.
- **Aula:** not supported, and not for lack of documentation. Three open projects describe
  the F75, and they disagree. Two different keyboards are sold under that name (wired
  `258A:010C` with 519-byte feature reports, and `3554:FA09` with 20-byte reports). For
  the first, [openaula](https://github.com/not-ayan/openaula) and
  [aula-f75](https://github.com/RustamSheoran/aula-f75) give different headers for the
  report that writes the keymap and put the Fn key at different positions (53 and 59).
  The keymap is written as one whole table, and openaula ships a tool to repair Fn keys
  that such writes destroyed. A driver needs someone with the keyboard to settle those two
  points by reading the table first.

## Not there yet

- Macros
- Rotary encoder turn actions (an encoder's press can be remapped)
- "Keycode" and "button" controls inside custom menus
- Magnetic switches beyond the basics: dynamic keystroke, SOCD, gamepad mode, calibration
- Magnetic keyboards other than Keychron and Lemokey
- Royal Kludge: the Fn layer, per-key colours, and the newer models
- Aula, and other keyboards with a protocol of their own (see "Good to know")
- Vial keyboards without a VIA file: they carry their definition inside the firmware,
  which OpenKeys does not read yet

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

Most definitions in `keyboards/` are copied from
[the-via/keyboards](https://github.com/the-via/keyboards) and keep their GPL-3.0 license
and their authors' copyright. The rest come from the makers' firmware repositories
(GPL-2.0-or-later) or are generated; [keyboards/README.md](keyboards/README.md) says which.

OpenKeys is not affiliated with VIA, QMK or any keyboard maker.
