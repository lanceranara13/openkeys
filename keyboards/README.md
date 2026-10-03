# Keyboards

One JSON file per keyboard. Every `.json` file in this folder, at any depth, is picked up
automatically. Folder names are only for people.

```sh
npm run add-keyboard -- --search <text>   # find a keyboard in the VIA collection
npm run add-keyboard <vendor/board>       # copy it here
npm run check                             # validate everything in this folder
```

The file format and a walkthrough are in [docs/adding-a-keyboard.md](../docs/adding-a-keyboard.md).

Files copied from [the-via/keyboards](https://github.com/the-via/keyboards) keep their
GPL-3.0 license.
