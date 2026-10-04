# Adding a keyboard

A keyboard is one `.json` file. The keyboard itself must run QMK firmware with VIA enabled.

Pick the path that fits you. Each is three steps.

## I just want to use my keyboard

No terminal, no code.

1. **Get the file.** Download your keyboard's definition from the maker's support page. It
   is usually called "VIA JSON".
2. **Try it.** In OpenKeys, open **Keyboards** and click **Try a definition file**. A
   virtual copy of your keyboard opens. Check that the picture matches the real thing.
3. **Connect.** Plug the keyboard in and click **Connect keyboard**. It is recognised from
   now on, in that browser.

If the file has a problem, a message says what is wrong, for example
`key "5,5" is outside the 5x15 matrix`.

## I want it built in for everyone

No terminal here either. Do the three steps above first, so you know the file is good.

1. **Open the form.** It is on GitHub:
   [Add a keyboard](https://github.com/lanceranara13/openkeys/issues/new?template=add-keyboard.yml).
2. **Drop the file in.** Drag the `.json` file into the form and say where it came from.
3. **Submit.** A maintainer adds it, and it is listed under its brand.

That needs a free GitHub account. The **Contribute** page in OpenKeys walks through the
same steps.

## I want to add it myself, with a pull request

1. **Add it.** One command finds the keyboard, copies its file into `keyboards/` and
   checks it:

   ```sh
   npm run add-keyboard q1
   ```

   It searches the VIA collection of 2,000+ keyboards. If several match, it lists them and
   asks which one. Got the file from the maker instead? Point at it:

   ```sh
   npm run add-keyboard ./my-board.json
   ```

2. **Look at it.** Run `npm run dev`, open **Keyboards** and click the keyboard. It is
   listed under its brand.
3. **Share it.** Commit the new file and open a pull request.

Nothing else needs editing. Every file in `keyboards/` is picked up automatically.

## No definition exists yet

Then one has to be written: a name, two USB ids, the matrix size and the layout. The format
and a worked example are in [definition-format.md](definition-format.md). When the file is
ready, follow any path above.

## Good to know

- **Brand.** The first folder under `keyboards/` is the brand a keyboard is listed under.
  `npm run add-keyboard` picks one for you; move the file to another folder to change it.
- **Magnetic switches.** Keychron HE keyboards get a **Switches** tab on their own. For
  another keyboard that uses the same commands, add `"analog": "keychron"` to its file.
- **Checking by hand.** `npm run check` checks every file in `keyboards/` and names the
  file and the problem:

  ```
  keyboards/my-brand/my-board.json: "vendorId" must look like "0x3434"
  ```
