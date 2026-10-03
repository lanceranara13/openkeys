# Adding a keyboard

A keyboard is one JSON file in `keyboards/`. Nothing else has to change: the folder is
scanned at build time, and the file is only downloaded when that keyboard connects.

The keyboard itself must run QMK firmware with VIA enabled.

## 1. Check whether a definition already exists

The VIA project keeps definitions for 2,000+ keyboards, and OpenKeys reads them unchanged.

```sh
npm run add-keyboard -- --search q1
```

```
  npm run add-keyboard keychron/q1/v1
  npm run add-keyboard keychron/q1/v2
  npm run add-keyboard keychron/q10
  ...
```

Copy the one you want (a folder brings every variant in it):

```sh
npm run add-keyboard keychron/q1
```

Have the file already, from the maker's support page? Point at it and it is copied to
`keyboards/custom/`:

```sh
npm run add-keyboard ./my-board.json
```

## 2. Or write one

Create `keyboards/<brand>/<board>.json`:

```json
{
  "name": "My Board",
  "vendorId": "0x1234",
  "productId": "0x5678",
  "matrix": { "rows": 2, "cols": 3 },
  "menus": ["qmk_rgblight"],
  "layouts": {
    "keymap": [
      ["0,0", "0,1", "0,2"],
      [{ "w": 2 }, "1,0", "1,2"]
    ]
  }
}
```

| Field | Meaning |
| --- | --- |
| `name` | Shown in the app |
| `vendorId`, `productId` | USB ids of the keyboard, as hex text. They decide which file a connected keyboard gets, so no two files may share a pair |
| `matrix` | `MATRIX_ROWS` and `MATRIX_COLS` of the firmware |
| `layouts.keymap` | Where every key sits. Draw it on [keyboard-layout-editor.com](http://www.keyboard-layout-editor.com) and paste the "Raw data" |
| `menus` | Optional. Settings beyond the keymap (see below) |
| `layouts.labels` | Optional. Names of the layout options (see below) |
| `customKeycodes` | Optional. Keys only this keyboard has: `[{ "name", "title", "shortName" }]` |
| `protocol` | Optional. Driver to use. Defaults to `"via"` |

### Keys

Each key's text says how it is wired, by legend position:

| Position | Text | Meaning |
| --- | --- | --- |
| Top-left | `0,1` | Matrix row 0, column 1. Required |
| Bottom-right | `2,0` | Layout option group 2, choice 0. Only for keys that depend on an option |
| Center | `e0` | Rotary encoder number 0 |

In the raw data, legends are separated by `\n`, so a key in option group 0, choice 1 reads
`"0,13\n\n\n0,1"`.

Keycap colours do not have to mean anything. The most common colour is drawn as a letter
key, the second as a modifier, any other as an accent.

### Layout options

For boards that can be built in more than one way (split backspace, ISO enter):

1. Give the keys of the standard build the legend `group,0`.
2. Draw the alternative keys anywhere to the side with `group,1` (`group,2`, ...). They
   are moved onto the standard keys automatically.
3. Name the options, in group order:

```json
"labels": ["Split Backspace", ["Bottom Row", "ANSI", "Tsangan", "WKL"]]
```

Plain text is an on/off option. A list is a name followed by its choices.

### Menus

`menus` adds tabs such as **Lighting**. Use the stock names for stock QMK features:

| Name | Controls |
| --- | --- |
| `qmk_backlight` | Single-colour backlight: brightness, breathing |
| `qmk_rgblight` | Underglow: brightness, effect, speed, colour |
| `qmk_backlight_rgblight` | Both of the above |
| `qmk_rgb_matrix` | Per-key RGB: brightness, effect, speed, colour |
| `qmk_led_matrix` | Per-key single colour: brightness, effect, speed |
| `qmk_audio` | Sound and key clicks |

Stock menus pick effects by number, because the numbering depends on how the firmware was
built. To list effects by name, write the menu out instead. Supported control types are
`range`, `dropdown`, `toggle` and `color`; `content` is `[name, channel, value id]`:

```json
"menus": [
  {
    "label": "Lighting",
    "content": [
      {
        "label": "Backlight",
        "content": [
          {
            "label": "Brightness",
            "type": "range",
            "options": [0, 255],
            "content": ["id_qmk_rgb_matrix_brightness", 3, 1]
          },
          {
            "label": "Effect",
            "type": "dropdown",
            "options": [["Off", 0], ["Solid", 1], ["Breathing", 2]],
            "content": ["id_qmk_rgb_matrix_effect", 3, 2]
          },
          {
            "label": "Color",
            "type": "color",
            "showIf": "{id_qmk_rgb_matrix_effect} != 0",
            "content": ["id_qmk_rgb_matrix_color", 3, 4]
          }
        ]
      }
    ]
  }
]
```

`showIf` hides a control depending on another control's value.

## 3. Check it

```sh
npm run check
```

This runs every file in `keyboards/` through the same parser the app uses and names the
file and the problem if one is wrong:

```
keyboards/my-brand/my-board.json: "vendorId" must look like "0x3434"
```

## 4. Look at it

```sh
npm run dev
```

Open the page, go to **Supported keyboards** and click your keyboard. A virtual copy opens
with your layout, layout options and menus, so they can be checked before the real board is
plugged in. Then connect the real one and remap a key.

## Without touching the code

Anyone can use an unlisted keyboard without this repository: connect it, and when the app
says it has no layout for it, load the definition file. It is stored in that browser only.
