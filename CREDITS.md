# Credits

OpenKeys stands on other people's work. This file lists every project that was copied
from, followed closely, or used as a reference, and what exactly was taken.

## Bundled with OpenKeys

### VIA keyboard definitions

- Source: [the-via/keyboards](https://github.com/the-via/keyboards)
- License: GPL-3.0
- Used for: most definition files under `keyboards/`: the whole `v3` folder of the
  collection, about 2,000 keyboards, except where a source listed next covers the same
  keyboard. They are copied unchanged by `npm run add-keyboard`. The definition file
  format itself is VIA's.

### Keychron and Lemokey definitions

- Source: [Keychron/qmk_firmware](https://github.com/Keychron/qmk_firmware), the `via_json`
  folders of its Keychron and Lemokey keyboards (branch `2025q3`)
- License: GPL-2.0-or-later
- Used for: the Keychron and Lemokey keyboards the VIA collection does not have, about
  190 files: the wireless K, Q and V boards (Pro and Max), the 8K boards and every
  magnetic HE board. They sit in `keyboards/keychron/` and `keyboards/lemokey/` and are
  copied unchanged, with one exception: the magnetic ones (folders ending in `_he`) have
  one line added, `"analog": "keychron"`, which tells OpenKeys how the keyboard's magnetic
  switches are configured. One upstream file is left out because it does not validate
  (`k17_max_jis_knob_white.json` uses a column outside its own matrix).

### NuPhy definitions

- Source: [nuphy-src/qmk_firmware](https://github.com/nuphy-src/qmk_firmware), the
  `keymaps/via` folder of each keyboard (branch `nuphy-keyboards`)
- License: GPL-2.0-or-later
- Used for: the eight files in `keyboards/nuphy/`, copied unchanged and renamed to
  `<board>/ansi.json`.

### Royal Kludge definitions

- Source: [Kludge Knight](https://github.com/vinc3m1/kludgeknight) (GPL-3.0), its folder
  `public/rk`: the per-model configuration files of Royal Kludge's own Windows software
- Used for: the files in `keyboards/royal_kludge/`. They are not copies:
  `scripts/import-royal-kludge.mjs` builds each one from a model's `KB.ini` (where every key
  sits in the vendor's picture, which key it is, and its place in the buffer the keyboard is
  sent) and from the names of the lighting effects. Four models are left out because
  [Rangoli's status list](https://github.com/rnayabed/rangoli/blob/master/keyboards-list.md)
  reports them as not working.

### kle-serial

- Source: [ijprest/kle-serial](https://github.com/ijprest/kle-serial)
- License: MIT
- Used for: the legend position table (`LEGEND_SLOTS`) in `src/core/kle.ts`, copied as is.

```
MIT License

Copyright (c) 2013-2019 Ian Prest

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Libraries and fonts in the built site

| Project | License | Used for |
| --- | --- | --- |
| [React](https://github.com/facebook/react) | MIT | The interface |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | Icons |
| [Simple Icons](https://github.com/simple-icons/simple-icons) | CC0-1.0 | The path of the GitHub mark in `src/components/GitHubMark.tsx`. The mark is GitHub's trademark, used only to link to the repository |
| [IBM Plex](https://github.com/IBM/plex) Sans and Mono | OFL-1.1 | Typefaces |
| [Fontsource](https://github.com/fontsource/fontsource) | MIT | Packaging of the fonts |

## Written for OpenKeys, following these sources

The code in these files is OpenKeys' own, but its behaviour and its numbers come from the
projects below. Without them it could not talk to a keyboard.

### QMK Firmware

- Source: [qmk/qmk_firmware](https://github.com/qmk/qmk_firmware)
- License: GPL-2.0-or-later
- `quantum/via.h` and `quantum/via.c`: the VIA protocol. Command ids, value ids, channel
  ids and report layout in `src/drivers/via.ts`, and the firmware behaviour that
  `src/transports/virtual.ts` imitates.
- `quantum/keycodes.h`: the keycode numbers in `src/core/keycodes.ts`.

### Keychron's QMK Firmware

- Source: [Keychron/qmk_firmware](https://github.com/Keychron/qmk_firmware)
- License: GPL-2.0-or-later
- `keyboards/keychron/common/keychron_raw_hid.c` and
  `keyboards/keychron/common/analog_matrix/` (`analog_matrix.c`, `analog_matrix_type.h`,
  `analog_matrix_eeconfig.h`, `profile.c`): the commands for magnetic switch settings.
  Command ids, the layout of a profile and of a key's settings, and the default values in
  `src/drivers/keychron-analog.ts`, and the firmware behaviour that
  `src/transports/virtual.ts` imitates for them.

### monsgeek-akko-linux

- Source: [echtzeit-solutions/monsgeek-akko-linux](https://github.com/echtzeit-solutions/monsgeek-akko-linux)
- License: GPL-3.0
- A community driver for Akko and MonsGeek keyboards on RongYuan firmware. Its protocol
  notes, its device database and the vendor web driver code it documents gave the
  commands in `src/drivers/yichip.ts` (identify, profile, keymap read, key remap, the
  checksum) and the key positions and default keys in
  `keyboards/akko/5075b_plus/5075b_plus.json`. Each was then confirmed on a real Akko
  5075B Plus before being used.

### Rangoli and Kludge Knight

- Sources: [rnayabed/rangoli](https://github.com/rnayabed/rangoli) and
  [vinc3m1/kludgeknight](https://github.com/vinc3m1/kludgeknight)
- License: GPL-3.0 (both)
- Two open configurators for Royal Kludge keyboards. Rangoli worked the protocol out from
  USB captures; Kludge Knight ported it to the browser and added key values from captures
  of its own.
- Rangoli's `src/keyboardconfiguratorcontroller.cpp` and Kludge Knight's
  `src/models/BufferCodec.ts` and `LightingCodec.ts`: the report id, the nine reports of a
  keymap with their headers, four bytes per key, and the lighting report, in
  `src/drivers/royal-kludge.ts`.
- Rangoli's `src/keycode.h` and Kludge Knight's `src/types/keycode.ts`: what the keyboard
  stores for each key (plain keys, modifier bits, media keys, Fn), in the driver's key
  list and in the table of `scripts/import-royal-kludge.mjs`.
- Rangoli's `keyboards-list.md`: which models are reported as not working.
- Not yet confirmed by OpenKeys on a real keyboard.

### VIA

- Sources: [the-via/app](https://github.com/the-via/app) and
  [the-via/reader](https://github.com/the-via/reader)
- License: GPL-3.0
- `app/src/utils/key-to-byte/v10.ts` to `v13.ts`: which keycode numbers belong to which
  protocol version, used in `src/core/keycodes.ts`.
- `reader/src/kle-parser.ts`: how VIA reads a layout. `src/core/kle.ts` follows the same
  rules (which legend holds the matrix position, the layout option and the encoder; blank
  keys as placeholders for an option; moving an option onto the place of the default one)
  so that existing definitions draw the way they do in VIA.

### Keyboard Layout Editor

- Source: [ijprest/keyboard-layout-editor](https://github.com/ijprest/keyboard-layout-editor)
- Used for: the layout format every definition is written in.

## Design

- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT): its
  analysis of the PostHog design system was the reference for [DESIGN.md](DESIGN.md): warm
  canvas, IBM Plex, flat bordered cards, one loud colour. The keycap styling, palette and
  layout are OpenKeys' own. OpenKeys is not affiliated with PostHog.

## Idea

- [OpenMouse](https://github.com/OpenMouse-Project/openmouse) (AGPL-3.0): the idea of one
  open, browser-based configurator for many devices. No code or design was taken from it.

## Build tools

[Vite](https://github.com/vitejs/vite), [Vitest](https://github.com/vitest-dev/vitest),
[TypeScript](https://github.com/microsoft/TypeScript) and
[ESLint](https://github.com/eslint/eslint).

## What this means for the license

OpenKeys ships GPL-3.0 definition files and follows GPL-licensed sources closely, so it
is released under the GNU General Public License, version 3. The text is in
[LICENSE](LICENSE).
