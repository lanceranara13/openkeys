# Contributing

The most useful thing to add is a keyboard, and that takes no code.

## Add a keyboard

A keyboard is one `.json` file, in the format VIA uses.

1. **Get the file.** Download your keyboard's definition from the maker's support page. It
   is usually called "VIA JSON".
2. **Check it.** In OpenKeys, open **Keyboards** and click **Try a definition file**. A
   virtual copy of your keyboard opens. If the picture matches the real thing, the file is
   good. If it has a problem, a message says what is wrong.
3. **Send it.** Open the
   [Add a keyboard](https://github.com/lanceranara13/openkeys/issues/new?template=add-keyboard.yml)
   form, drop the file in and submit. A maintainer adds it.

That needs a free GitHub account and nothing else.

Prefer a pull request? One command adds the file and checks it:

```sh
npm install
npm run add-keyboard q1               # from the VIA collection of 2,000+ keyboards
npm run add-keyboard ./my-board.json  # or a file you have
npm run check
```

Commit the new file and open a pull request. Nothing else needs editing. The details are
in [docs/adding-a-keyboard.md](docs/adding-a-keyboard.md).

## Other ways to help

- **Report a problem.** [Open an issue](https://github.com/lanceranara13/openkeys/issues/new/choose)
  and say which keyboard and what you saw.
- **Test on a real keyboard.** The Switches tab is written from Keychron's published
  firmware and tested against an emulator. If you own a Keychron HE or Lemokey HE, try it
  and say what happened.
- **Write a driver.** A keyboard that does not speak VIA needs one:
  [docs/adding-a-driver.md](docs/adding-a-driver.md).

## Changing code

```sh
npm install
npm run dev
```

- Run `npm run check` before committing. It type checks, lints and tests, and it validates
  every file in `keyboards/`.
- The look of the app is described in [DESIGN.md](DESIGN.md). Keep to it.
- When you copy from or closely follow another project, add it to [CREDITS.md](CREDITS.md).

## License

OpenKeys is free software under GPL-3.0. What you contribute is shared under the same
license, so send only what you are allowed to share, and say where a definition file came
from.
