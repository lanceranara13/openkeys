# Keyboards

One JSON file per keyboard. Every `.json` file in this folder, at any depth, is picked up
automatically. The first folder is the brand the keyboard is listed under; deeper folders
are only for people.

```sh
npm run add-keyboard <words>          # find a keyboard in the VIA collection and copy it here
npm run add-keyboard <vendor/board>   # the same, naming its folder outright
npm run check                         # validate everything in this folder
```

The file format and a walkthrough are in [docs/adding-a-keyboard.md](../docs/adding-a-keyboard.md).

Where the files come from, and their licenses:

- Most are copied unchanged from [the-via/keyboards](https://github.com/the-via/keyboards)
  (GPL-3.0): its whole `v3` folder. `npm run add-keyboard` picks up boards added there since.
- The Keychron and Lemokey boards that collection does not have (the wireless K, Q and V
  boards, the 8K boards, the magnetic HE boards) come from the `via_json` folders of
  [Keychron/qmk_firmware](https://github.com/Keychron/qmk_firmware) (GPL-2.0-or-later).
  The magnetic ones have one line added: `"analog": "keychron"`.
- `nuphy/` comes from [nuphy-src/qmk_firmware](https://github.com/nuphy-src/qmk_firmware)
  (GPL-2.0-or-later).
- `royal_kludge/` is generated, not copied. These keyboards do not speak VIA; their files
  name the `royal-kludge` driver and list every key's default. To rebuild them from a
  checkout of [Kludge Knight](https://github.com/vinc3m1/kludgeknight) (GPL-3.0):

  ```sh
  node scripts/import-royal-kludge.mjs <path to kludgeknight>/public/rk
  ```

  It prints the models it leaves out and why. Do not edit these files by hand.
- `akko/5075b_plus/` was written for OpenKeys and checked on the keyboard.

[CREDITS.md](../CREDITS.md) has the details.
