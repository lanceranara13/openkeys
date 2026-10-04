# Keyboards

One JSON file per keyboard. Every `.json` file in this folder, at any depth, is picked up
automatically. The first folder is the brand the keyboard is listed under; deeper folders
are only for people.

```sh
npm run add-keyboard -- --search <text>   # find a keyboard in the VIA collection
npm run add-keyboard <vendor/board>       # copy it here
npm run check                             # validate everything in this folder
```

The file format and a walkthrough are in [docs/adding-a-keyboard.md](../docs/adding-a-keyboard.md).

Where the files come from, and their licenses:

- Most are copied unchanged from [the-via/keyboards](https://github.com/the-via/keyboards)
  (GPL-3.0).
- The magnetic Keychron boards (`keychron/*_he/`) and `lemokey/` come from
  [Keychron/qmk_firmware](https://github.com/Keychron/qmk_firmware) (GPL-2.0-or-later),
  each with one line added: `"analog": "keychron"`.
