import {
  ArrowRight,
  Download,
  FileJson,
  Keyboard,
  Layers,
  Palette,
  Play,
  ShieldCheck,
  Terminal,
  Usb,
  Zap,
} from 'lucide-react';
import { useEffect } from 'react';
import { groupByBrand } from '../core/keyboard-list';
import { resolveLayout } from '../core/kle';
import { bundledKeyboards } from '../core/registry';
import { demoDefinition, demoPreview } from '../demo';
import { KeyboardView } from './KeyboardView';

interface Props {
  onConnect: () => void;
  onDemo: () => void;
}

const previewLayout = resolveLayout(demoDefinition.layout);
const brands = groupByBrand(bundledKeyboards);
// The landing page only names a few brands; the Keyboards page lists everything.
const MAX_BRANDS = 12;

/** The fact sheet beside the headline. */
const SPEC = [
  ['Install', 'Nothing'],
  ['Account', 'None'],
  ['Price', 'Free, open source'],
  ['Works with', 'QMK + VIA keyboards'],
  ['Browsers', 'Chrome, Edge, Opera, Brave'],
  ['Built in', `${bundledKeyboards.length} keyboards`],
];

const STEPS = [
  {
    title: 'Plug in and connect',
    text: 'Click Connect and pick your keyboard in the list your browser shows. No driver, no download.',
  },
  {
    title: 'Click a key',
    text: 'Your real layout appears on screen. Click the key you want to change.',
  },
  {
    title: 'Choose what it does',
    text: 'Pick a new key, a layer switch or a media control. The keyboard remembers it instantly.',
  },
];

const FEATURES = [
  {
    icon: Keyboard,
    title: 'Remap any key',
    text: 'Letters, modifiers, media keys, shifted symbols, numpad. Or type any QMK keycode by name.',
  },
  {
    icon: Layers,
    title: 'Layers',
    text: 'Edit every layer your keyboard has, and place the keys that hold, toggle or switch between them.',
  },
  {
    icon: Palette,
    title: 'RGB and lighting',
    text: 'Brightness, effect, speed and colour, applied live, using the settings your keyboard defines.',
  },
  {
    icon: Download,
    title: 'Backup and restore',
    text: 'Export every layer to one file and load it back whenever you need it.',
  },
  {
    icon: Zap,
    title: 'Nothing to install',
    text: 'Runs in Chrome, Edge, Opera and Brave on Windows, macOS, Linux and ChromeOS.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'No account, no tracking, no server. The page talks straight to your keyboard over USB.',
  },
];

const ADD_WAYS = [
  {
    icon: FileJson,
    title: 'No code: load a file',
    text: 'Connect the keyboard, then load its VIA JSON when asked. It works at once and stays in your browser.',
  },
  {
    icon: Terminal,
    title: 'One command',
    text: 'Copy a definition from the VIA collection of 2,000+ keyboards into this project.',
    code: 'npm run add-keyboard keychron/q1',
  },
  {
    icon: Keyboard,
    title: 'Write your own',
    text: 'One JSON file: a name, two USB ids, the matrix size and the layout from keyboard-layout-editor.com.',
    code: 'keyboards/my-brand/my-board.json',
  },
];

const FAQ = [
  {
    question: 'Which keyboards work?',
    answer:
      'Keyboards running QMK firmware with VIA enabled. That covers the Keychron Q and V series, the GMMK Pro and thousands of custom boards. If yours is not built in, load its VIA definition file and it works the same.',
  },
  {
    question: 'Can this break my keyboard?',
    answer:
      'OpenKeys only changes the keymap and lighting settings, with the same commands VIA uses. It never flashes firmware. If a layout goes wrong, “Reset keymap” puts every key back to how the keyboard shipped.',
  },
  {
    question: 'Why does it not work in Firefox or Safari?',
    answer:
      'They do not support WebHID, the browser feature that lets a page talk to a USB device. Use Chrome, Edge, Opera or Brave on a computer. The demo keyboard works in every browser.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. There is no sign-up, no analytics and no server. Your keymap lives on the keyboard, and backups are files you keep.',
  },
  {
    question: 'My keyboard does not use VIA. Can it be supported?',
    answer:
      'Yes, with a driver. Everything the app needs from a keyboard is one small interface, and a driver for another protocol plugs into it without touching the interface code. See docs/adding-a-driver.md.',
  },
];

function Eyebrow({ number, children }: { number: string; children: string }) {
  return (
    <p className="eyebrow">
      <span className="eyebrow__number">{number}</span>
      {children}
    </p>
  );
}

export function Landing({ onConnect, onDemo }: Props) {
  // Arriving from another page with a section link: the section did not exist when
  // the browser tried to scroll to it.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && !id.startsWith('/')) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <>
      <section className="hero container">
        <div>
          <p className="eyebrow">Open source keyboard configurator</p>
          <h1 className="hero__title">
            Configure any keyboard.
            <br />
            <span className="hl">Right in your browser.</span>
          </h1>
          <p className="hero__lead">
            OpenKeys remaps keys, edits layers and tunes RGB on VIA-compatible keyboards. Plug in,
            click a key, pick what it does. That is the whole manual.
          </p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={onConnect}>
              <Usb size={18} aria-hidden /> Connect keyboard <ArrowRight size={18} aria-hidden />
            </button>
            <button type="button" className="btn btn--lg" onClick={onDemo}>
              <Play size={18} aria-hidden /> Try the demo
            </button>
          </div>
        </div>

        <dl className="spec card" aria-label="At a glance">
          {SPEC.map(([name, value]) => (
            <div key={name} className="spec__row">
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <figure className="figure container">
        <div aria-hidden>
          <KeyboardView
            layout={previewLayout}
            cols={demoDefinition.matrix.cols}
            keycodes={demoPreview.keycodes}
            describe={demoPreview.describe}
          />
        </div>
        <figcaption className="figure__caption">
          Fig. 1 · The demo keyboard. No keyboard nearby?{' '}
          <button type="button" className="link" onClick={onDemo}>
            Open it
          </button>{' '}
          and remap a key.
        </figcaption>
      </figure>

      <section id="how" className="section container">
        <Eyebrow number="01">How it works</Eyebrow>
        <h2 className="section__title">Three steps. No manual.</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="step">
              <span className="keycap">{index + 1}</span>
              <h3 className="step__title">{step.title}</h3>
              <p className="step__text">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section container">
        <Eyebrow number="02">What it does</Eyebrow>
        <h2 className="section__title">Everything your keyboard can do, in one tab.</h2>
        <div className="grid grid--3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card">
              <span className="icon-tile">
                <feature.icon size={20} aria-hidden />
              </span>
              <h3 className="card__title">{feature.title}</h3>
              <p className="card__text">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="keyboards" className="section container">
        <Eyebrow number="03">Supported keyboards</Eyebrow>
        <h2 className="section__title">
          <span className="hl">{bundledKeyboards.length} built in.</span> Any VIA keyboard with one
          file.
        </h2>
        <p className="section__lead">
          Built-in keyboards are recognised the moment you connect them. Anything else works by
          loading its VIA definition file.
        </p>
        <ul className="boards">
          {brands.slice(0, MAX_BRANDS).map((group) => (
            <li key={group.brand} className="tag">
              {group.brand} · {group.keyboards.length}
            </li>
          ))}
          {brands.length > MAX_BRANDS && (
            <li className="boards__more">and {brands.length - MAX_BRANDS} more brands</li>
          )}
        </ul>
        <div className="hero__actions">
          <a className="btn btn--lg" href="#/keyboards">
            Browse all {bundledKeyboards.length} keyboards <ArrowRight size={18} aria-hidden />
          </a>
        </div>
      </section>

      <section id="add" className="section container">
        <Eyebrow number="04">Add your keyboard</Eyebrow>
        <h2 className="section__title">Support for a new board is one file.</h2>
        <p className="section__lead">
          OpenKeys reads the same definition files as VIA. No code to write, no build step to learn.
        </p>
        <div className="grid grid--3">
          {ADD_WAYS.map((way) => (
            <article key={way.title} className="card">
              <span className="icon-tile">
                <way.icon size={20} aria-hidden />
              </span>
              <h3 className="card__title">{way.title}</h3>
              <p className="card__text">{way.text}</p>
              {way.code && <code className="code">{way.code}</code>}
            </article>
          ))}
        </div>
        <p className="section__lead section__lead--after">
          Then run <code>npm run check</code> to validate it. The full walkthrough is in{' '}
          <code>docs/adding-a-keyboard.md</code>.
        </p>
      </section>

      <section id="faq" className="section container">
        <Eyebrow number="05">Questions</Eyebrow>
        <h2 className="section__title">Questions, answered.</h2>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.question} className="faq__item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="cta">
          <h2 className="section__title">Ready when your keyboard is.</h2>
          <p className="section__lead">It takes about ten seconds to remap your first key.</p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={onConnect}>
              <Usb size={18} aria-hidden /> Connect keyboard
            </button>
            <button type="button" className="btn btn--lg" onClick={onDemo}>
              <Play size={18} aria-hidden /> Try the demo
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
