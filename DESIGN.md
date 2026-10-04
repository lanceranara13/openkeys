# OpenKeys design

The look of the app, as built in `src/styles.css`. Tokens are CSS custom properties on
`:root`; change them there.

Reference: the PostHog system in
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (warm cream canvas,
olive ink, IBM Plex, flat hairline cards, one loud colour). The keycap language, the
palette and the layout below are OpenKeys' own.

## 1. Visual theme and atmosphere

A printed quick-start guide for a keyboard, laid on a desk next to the keyboard itself.

Warm paper canvas, dark ink, hairline rules, numbered sections. Nothing glows, nothing is
a gradient, nothing is glass. The one dark object on the page is the keyboard: a
charcoal case with a classic colorway, cream letter keys, grey modifiers, vermilion accents.

**Everything you can press is a keycap.** Buttons, the keys you assign, step numbers and
the logo all have a flat top face and a visible side wall underneath, and sink onto that
wall when pressed. That one idea is the identity; the rest stays quiet.

Light by default, with a dark variant (section 2). The page follows the system setting
until someone uses the switch in the header; the choice is then remembered in that browser.

## 2. Colour palette and roles

Two colours carry meaning, and they never swap roles:

- **Vermilion means "press this".** Primary buttons, accent keys, the logo.
- **Yellow means "you are here".** The selected key, its current value in the picker, the
  active step, highlighted words.

| Token | Value | Role |
| --- | --- | --- |
| `--canvas` | `#f1efe7` | Page background. Never pure white |
| `--surface` | `#ffffff` | Cards, inputs, secondary buttons |
| `--surface-soft` | `#e7e4d9` | Tab track, inline code, disabled fills |
| `--ink` | `#1f211c` | Headings, strong text, active chips |
| `--body` | `#4a4c44` | Paragraph text |
| `--muted` | `#6b6d62` | Captions, eyebrows, hints |
| `--faint` | `#96978c` | Placeholders, disabled text |
| `--line` | `#c6c4b7` | Card borders, the wall under secondary buttons |
| `--line-soft` | `#dedcd1` | Rules between sections and rows |
| `--accent` / `--accent-wall` | `#d4421c` / `#9a2e11` | Action colour and its keycap wall |
| `--mark` / `--mark-wall` | `#ffd84a` / `#c9a31c` | Selection colour and its keycap wall |
| `--case` | `#2a2c26` | Keyboard case, code blocks, toast, closing panel |
| `--cap` / `--cap-wall` | `#f6f4ec` / `#cbc8b9` | Letter keys |
| `--cap-mod` / `--cap-mod-wall` | `#c4c1b3` / `#9d9a8c` | Modifier keys |
| `--ok` / `--danger` | `#2c8c66` / `#b3261e` | Connected and done; destructive and errors |
| `--focus` | `#1d4ed8` | Keyboard focus ring (yellow on the dark case) |

White text on `--accent` is 4.6:1. Ink on `--mark` is 11.7:1.

### Dark variant

The same guide printed on charcoal. It is not a second design: `:root[data-theme='dark']`
overrides tokens and nothing else, so no component has a dark-only rule. Add a colour by
adding a token to both blocks.

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas` | `#f1efe7` | `#181916` |
| `--surface` | `#ffffff` | `#22241f` |
| `--surface-soft` | `#e7e4d9` | `#2c2e28` |
| `--ink` | `#1f211c` | `#f3f1e8` |
| `--body` | `#4a4c44` | `#c9c7ba` |
| `--muted` | `#6b6d62` | `#9d9c8f` |
| `--line` / `--line-soft` | `#c6c4b7` / `#dedcd1` | `#44463c` / `#31332c` |
| `--accent` | `#d4421c` | unchanged |
| `--accent-ink` (vermilion as text) | `#c03a17` | `#ff916d` |
| `--mark` | `#ffd84a` | unchanged |
| `--hl` (highlighter stroke) | `--mark` | yellow at 30% |
| `--case` / `--case-line` | `#2a2c26` / same | `#0f100d` / `#3a3c33` |
| `--cap` / `--cap-wall` | `#f6f4ec` / `#cbc8b9` | `#40423a` / `#25261f` |
| `--cap-mod` / `--cap-mod-wall` | `#c4c1b3` / `#9d9a8c` | `#2d2f29` / `#191a16` |
| `--cap-edge` (wall of a keycap on a card) | `#cbc8b9` | `#121310` |

What stays the same in both: vermilion and yellow, and `--on-mark` (`#1f211c`), because
text on yellow is always dark. In the dark variant the keyboard switches to a dark
colorway with light legends, and the case gains a hairline so it still reads as an object
on the dark page.

## 3. Typography

- **IBM Plex Sans Variable** for everything read as language. **IBM Plex Mono** for
  everything read as data: eyebrows, USB ids, keycodes, captions, tags, commands. Both
  self-hosted through Fontsource, so no font request leaves the site.
- Hierarchy comes from weight, not colour: 400 body, 500 labels, 600 titles and buttons,
  700 headlines.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Hero headline | `clamp(32px, 4.5vw, 54px)` | 700 | Tracking −0.025em, line height 1.1 |
| Section title | `clamp(26px, 3.4vw, 36px)` | 700 | Tracking −0.02em |
| Card and step title | 18–19px | 600 | |
| Body | 16px / 1.55 | 400 | Leads are 17–19px |
| Eyebrow | 12.5px mono | 600 | Uppercase, tracking 0.08em, numbered `01`–`05` |
| Button | 15px | 600 | |
| Keycap legend | 25% of one key unit | 600 | 18% for legends longer than five characters |

## 4. Components

- **Keycap button** (`.btn`): flat face, 1px border, 6px radius and a 3px wall drawn with
  `box-shadow: 0 3px 0`. On press it moves down 3px and the wall disappears. Default is a
  white cap on a `--line` wall; primary is vermilion on its own wall; danger is rose.
  Disabled buttons sit pressed down with no wall.
- **Keyboard** (`.board`): charcoal case, 10px radius. Keys are flat fills with the wall
  drawn inside the cap, so legends sit slightly high like on a real keycap. The shadow
  under the case takes the colour of the keyboard's own lighting.
- **Assignable key** (`.keycode`): a small cream keycap. Dark wall on hover, yellow when it
  is the selected key's current value.
- **Step number** (`.keycap`, `.steps-bar__number`, `.ministeps`): a yellow keycap with a
  mono numeral.
- **Card** (`.card`): white, 1px `--line` border, 6px radius, 24px padding. No shadow.
- **Fact sheet** (`.spec`): a card of label/value rows beside the headline, mono labels on
  the left, bold values on the right.
- **Tabs** (`.tabs`): a soft grey track; the active tab is a white card lifted off it.
- **Chips** (`.chip`): squared, outlined. The active chip inverts to ink.
- **Tag** (`.tag`): small mono label with a hairline border. Yellow for notes.
- **Inputs**: white, 1px border, 6px radius. Focus thickens the border to ink.
- **Code**: inline code is a soft grey chip; blocks are cream text on `--case`.
- **Keyboard list** (`.brand`, `.boards__item`): the Keyboards page. One section per brand,
  A to Z, separated by a soft rule. Each keyboard is an outlined button with its model and,
  in mono, its USB id; it turns yellow on hover. A search field and a row of brand chips
  sit above the list.
- **Switches tab**: the keyboard again, with a second mono line under each legend showing
  where the key registers (`2.0`, `0.8 RT`). Keys with their own settings get that line on
  a vermilion chip. Clicking keys selects them in yellow; the panel below edits the
  selection, or all keys when nothing is selected.
- **Toast**: cream text on `--case`, bottom centre, click to dismiss.
- **Theme switch**: a small keycap button in the header, labelled with the theme it
  switches to ("Dark" / "Light") next to a moon or sun.

## 5. Layout

- Content width 1120px, side gutter 20px. The connect card is 620px.
- The hero is two columns: headline and actions on the left, the fact sheet on the right,
  aligned to the bottom. The keyboard follows full width as a captioned figure.
- Everything is left-aligned. Nothing is centred except text inside buttons and keys.
- Sections are numbered `01`–`05`, separated by a `--line-soft` rule, 64px apart.
- Card grids are `repeat(auto-fit, minmax(280px, 1fr))` with a 16px gap.
- Spacing steps: 4, 6, 8, 12, 16, 24, 32, 48, 64.
- Radii: 4px small tags, 6px nearly everything, 10px the keyboard case and closing panel.

## 6. Depth and elevation

There is one kind of depth: the keycap wall. It appears only on things that can be pressed.

| Level | Treatment | Used for |
| --- | --- | --- |
| Flat | No border | Text on the canvas |
| Outlined | 1px `--line` | Cards, inputs, chips, tags |
| Raised | Face plus 3px wall | Buttons, assignable keys, step numbers, logo |
| Object | `--case` fill | The keyboard, code blocks, toast, closing panel |

No drop shadows, no blur, no gradients. The single soft shadow in the app is under the
keyboard case, because that is the keyboard's lighting.

## 7. Do and do not

- Do give every clickable action a wall, and nothing else.
- Do keep vermilion for actions and yellow for the current selection.
- Do write interface text as plain instructions: "Click a key", "Choose what it does".
- Do set anything a person might copy (ids, keycodes, commands) in mono.
- Do not use pure white or pure black as the page. Both themes are warm.
- Do not write dark-only component rules. Change a token instead.
- Do not add gradients, glows, blurs or pill-shaped buttons.
- Do not centre headlines or stack a centred hero over a framed screenshot.
- Do not introduce a third loud colour.

## 8. Responsive behaviour

- The keyboard picture is fluid: keys are positioned in percent and legends size with
  container query units, so any layout fits any width.
- Below 860px the hero stacks: headline, then fact sheet.
- Below 760px the header navigation hides, the theme switch shows its icon only, sections
  tighten and setting rows stack.
- `prefers-reduced-motion` turns off the key-press movement and smooth scrolling.
- Keyboard focus is always visible: a 2px blue outline, yellow on the dark case.
