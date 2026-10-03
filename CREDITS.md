# Credits

OpenKeys stands on other people's work. This file lists every project that was copied
from, followed closely, or used as a reference, and what exactly was taken.

## Bundled with OpenKeys

### VIA keyboard definitions

- Source: [the-via/keyboards](https://github.com/the-via/keyboards)
- License: GPL-3.0
- Used for: every definition file under `keyboards/`. They are copied unchanged by
  `npm run add-keyboard`. The definition file format itself is VIA's.

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
