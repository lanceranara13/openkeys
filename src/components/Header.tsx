import { Moon, Sun } from 'lucide-react';
import type { Route } from '../app/useHashRoute';
import type { Theme } from '../app/useTheme';

interface Props {
  route: Route;
  /** Name of the connected keyboard, if any. */
  deviceName: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ route, deviceName, theme, onToggleTheme }: Props) {
  const otherTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="header">
      <div className="container header__inner">
        <a className="logo" href="#top">
          <span className="logo__mark" aria-hidden>
            OK
          </span>
          OpenKeys
        </a>

        <nav className="header__nav" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#/keyboards" aria-current={route === 'keyboards' ? 'page' : undefined}>
            Keyboards
          </a>
          <a href="#add">Add yours</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="header__actions">
          <button
            type="button"
            className="btn btn--sm"
            aria-label={`Switch to ${otherTheme} theme`}
            title={`Switch to ${otherTheme} theme`}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
            <span className="theme-toggle__label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          {route === 'configure' ? (
            <span className={`status${deviceName ? '' : ' status--off'}`}>
              <span className="status__dot" aria-hidden />
              {deviceName ?? 'Not connected'}
            </span>
          ) : (
            <a className="btn btn--primary btn--sm" href="#/configure">
              Open configurator
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
