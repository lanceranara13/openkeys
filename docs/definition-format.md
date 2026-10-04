# Definition format

How to write a keyboard definition from scratch. Most keyboards already have one; see
[adding-a-keyboard.md](adding-a-keyboard.md) first.

The format is VIA's (version 3), so a file written for VIA works here and the other way
round.

## A complete example

`keyboards/my_brand/sixty.json`:

```json
{
  "name": "My Brand Sixty",
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

## Fields

| Field | Meaning |
| --- | --- |
| `name` | Shown in the app |
| `vendorId`, `productId` | USB ids of the keyboard, as hex text. They decide which file a connected keyboard gets, so no two files may share a pair |
| `matrix` | `MATRIX_ROWS` and `MATRIX_COLS` of the firmware |
| `layouts.keymap` | Where every key sits. Draw it on [keyboard-layout-editor.com](http://www.keyboard-layout-editor.com) and paste the "Raw data" |
| `layouts.labels` | Optional. Names of the layout options (below) |
| `menus` | Optional. Settings beyond the keymap, such as lighting (below) |
| `customKeycodes` | Optional. Keys only this keyboard has: `[{ "name", "title", "shortName" }]` |
| `analog` | Optional. How magnetic switches are configured. `"keychron"` is the only value so far |
| `protocol` | Optional. Driver to use. Defaults to `"via"` |

## The folder is the brand

The first folder under `keyboards/` is the brand. The **Keyboards** page lists brands A to
Z and each brand's keyboards by name.

The brand is spelled the way the keyboard names spell it. With the folder `my_brand` and
the name "My Brand Sixty", the brand is "My Brand" and the keyboard is listed as "Sixty".
If no name starts with the folder name, the folder name is used (`keebio` becomes
"Keebio").

## Keys

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

## Layout options

For boards that can be built in more than one way (split backspace, ISO enter):

1. Give the keys of the standard build the legend `group,0`.
2. Draw the alternative keys anywhere to the side with `group,1` (`group,2`, ...). They
   are moved onto the standard keys automatically.
3. Name the options, in group order:

```json
"labels": ["Split Backspace", ["Bottom Row", "ANSI", "Tsangan", "WKL"]]
```

Plain text is an on/off option. A list is a name followed by its choices.

## Menus

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

Keyboards that keep their switch settings in menus (actuation and rapid trigger for the
whole board, as some capacitive and magnetic boards do) need nothing more: those menus
show up as tabs like any other.

## Magnetic switches

The **Switches** tab sets the actuation point and rapid trigger for all keys or key by
key. It appears when the keyboard answers Keychron's switch commands:

- Keychron and Lemokey keyboards (USB vendor ids `0x3434` and `0x362D`) are asked
  automatically.
- Any other keyboard that uses the same commands is asked when its file says
  `"analog": "keychron"`.

A keyboard with a different switch protocol needs code:
[adding-a-driver.md](adding-a-driver.md).
