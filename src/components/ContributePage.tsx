import { ArrowRight, Bug, Cpu, FlaskConical } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { ADD_KEYBOARD_URL, NEW_ISSUE_URL, REPO_URL, fileUrl } from '../app/links';
import { GitHubMark } from './GitHubMark';
import { TryFileButton } from './TryFileButton';

interface Props {
  /** Checks a definition file and opens a virtual copy of the keyboard it describes. */
  onTryFile: (file: File) => void;
}

/** The same thing with git, for people who would rather open a pull request. */
const PULL_REQUEST_STEPS = [
  {
    title: 'Fork and clone.',
    text: 'Fork the repository on GitHub, clone your fork, then install.',
    code: 'npm install',
  },
  {
    title: 'Add the keyboard.',
    text: (
      <>
        One command finds it in the VIA collection of 2,000+ keyboards, copies its file into{' '}
        <code>keyboards/</code> and checks it. Have the file from the maker instead? Put its path
        in place of the name: <code>./my-board.json</code>
      </>
    ),
    code: 'npm run add-keyboard q1',
  },
  {
    title: 'Look at it.',
    text: 'Start the app, open Keyboards and click the keyboard. It is listed under its brand.',
    code: 'npm run dev',
  },
  {
    title: 'Open a pull request.',
    text: 'Run the checks, commit the new file and push. Nothing else needs editing.',
    code: 'npm run check',
  },
];

const OTHER_WAYS = [
  {
    icon: Bug,
    title: 'Report a problem',
    text: 'A key drawn in the wrong place, a setting that does nothing? Say which keyboard and what you saw.',
    link: 'Open an issue',
    href: NEW_ISSUE_URL,
  },
  {
    icon: FlaskConical,
    title: 'Test on a real keyboard',
    text: 'The Switches tab is written from Keychron’s published firmware and tested against an emulator. Own a Keychron HE or Lemokey HE? Try it and tell us what happened.',
    link: 'Share what you found',
    href: NEW_ISSUE_URL,
  },
  {
    icon: Cpu,
    title: 'Write a driver',
    text: 'A keyboard that does not speak VIA needs a driver. It is one small interface, and no interface code has to change.',
    link: 'Read the driver guide',
    href: fileUrl('docs/adding-a-driver.md'),
  },
];

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** How to add a keyboard, and the other ways to help. */
export function ContributePage({ onTryFile }: Props) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container page contribute">
      <section className="contribute__intro">
        <p className="eyebrow">Contribute</p>
        <h1 className="section__title">
          <span className="hl">Add your keyboard.</span> No code, no terminal.
        </h1>
        <p className="section__lead">
          Support for a keyboard is one <code>.json</code> file. Check it here, send it on GitHub,
          and it is built in for everyone.
        </p>

        <ol className="steps">
          <li className="step">
            <span className="keycap">1</span>
            <h2 className="step__title">Get the file</h2>
            <p className="step__text">
              Every VIA keyboard has a definition file. Download it from the maker’s support page,
              where it is usually called “VIA JSON”.
            </p>
          </li>
          <li className="step">
            <span className="keycap">2</span>
            <h2 className="step__title">Check it</h2>
            <p className="step__text">
              Pick the file. A virtual copy of your keyboard opens. If the picture matches the real
              thing, the file is good. Then come back to this page.
            </p>
            <div className="step__action">
              <TryFileButton onTryFile={onTryFile} />
            </div>
          </li>
          <li className="step">
            <span className="keycap">3</span>
            <h2 className="step__title">Send it</h2>
            <p className="step__text">
              A short form opens on GitHub. Drop the same file into it and press Submit. A
              maintainer adds it, and it is listed under its brand for everyone.
            </p>
            <div className="step__action">
              <a
                className="btn btn--primary"
                href={ADD_KEYBOARD_URL}
                target="_blank"
                rel="noreferrer"
              >
                <GitHubMark /> Send it on GitHub <ArrowRight size={16} aria-hidden />
              </a>
            </div>
          </li>
        </ol>

        <p className="contribute__note">
          Step 3 needs a free GitHub account. Steps 1 and 2 need nothing.
        </p>
      </section>

      <section className="section">
        <p className="eyebrow">With git</p>
        <h2 className="section__title">Prefer a pull request?</h2>
        <p className="section__lead">
          The same thing from a terminal. Needs Node.js 20.19+ or 22.12+.
        </p>
        <div className="card contribute__path">
          <ol className="ministeps">
            {PULL_REQUEST_STEPS.map((step) => (
              <li key={step.title}>
                <div>
                  <p>
                    <strong>{step.title}</strong> {step.text}
                  </p>
                  <code className="code">{step.code}</code>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="hero__actions">
          <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
            <GitHubMark /> Open the repository
          </a>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Beyond keyboards</p>
        <h2 className="section__title">Other ways to help.</h2>
        <div className="grid grid--3">
          {OTHER_WAYS.map((way) => (
            <article key={way.title} className="card">
              <span className="icon-tile">
                <way.icon size={20} aria-hidden />
              </span>
              <h3 className="card__title">{way.title}</h3>
              <p className="card__text">{way.text}</p>
              <p className="card__link">
                <External href={way.href}>{way.link}</External>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Questions</p>
        <h2 className="section__title">Before you send.</h2>
        <div className="faq">
          <details className="faq__item">
            <summary>I cannot find a definition file for my keyboard.</summary>
            <p>
              If the keyboard works in VIA, a file exists: look on the maker’s support page, or ask
              them for the “VIA JSON”. If none exists, one has to be written: a name, two USB ids,
              the matrix size and the layout.{' '}
              <External href={fileUrl('docs/definition-format.md')}>
                The format, with a worked example.
              </External>
            </p>
          </details>
          <details className="faq__item">
            <summary>My keyboard is already in VIA’s collection. Do I still need the file?</summary>
            <p>
              No. Write the keyboard’s name in the form instead of dropping a file. A maintainer
              copies it from the collection.
            </p>
          </details>
          <details className="faq__item">
            <summary>The check says my file has a problem.</summary>
            <p>
              The message names it, for example <code>key "5,5" is outside the 5x15 matrix</code>.
              Fix that line and try again, or send the file anyway and paste the message into the
              form.
            </p>
          </details>
          <details className="faq__item">
            <summary>Whose file is it once I send it?</summary>
            <p>
              Its author’s, still. Keyboard definitions in OpenKeys are free software under GPL-3.0,
              so send only a file you are allowed to share, and say where it came from. The form
              asks.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
