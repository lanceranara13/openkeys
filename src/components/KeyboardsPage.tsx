import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { bundledKeyboards } from '../core/bundled';
import { deviceKey } from '../core/definition';
import { groupByBrand, searchKeyboards } from '../core/keyboard-list';
import { TryFileButton } from './TryFileButton';

interface Props {
  /** Opens a virtual copy of a built-in keyboard, by its path in `keyboards/`. */
  onPreview: (path: string) => void;
  /** Checks a definition file and opens a virtual copy of the keyboard it describes. */
  onTryFile: (file: File) => void;
}

const allBrands = groupByBrand(bundledKeyboards);

const brandAnchor = (brand: string) => `brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const plural = (count: number, word: string) =>
  `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;

/**
 * Each first letter with the brand it starts at and how many brands share it, in list
 * order. With hundreds of brands a chip per brand would be a wall of chips.
 */
const letters = (() => {
  const starts = new Map<string, { brand: string; brands: number }>();
  for (const { brand } of allBrands) {
    const letter = /^[a-z]/i.test(brand) ? brand[0].toUpperCase() : '0–9';
    const seen = starts.get(letter);
    if (seen) seen.brands += 1;
    else starts.set(letter, { brand, brands: 1 });
  }
  return [...starts];
})();

/** Every built-in keyboard, by brand, with a search across brand, model and USB id. */
export function KeyboardsPage({ onPreview, onTryFile }: Props) {
  const [typed, setTyped] = useState('');
  // Typing stays quick: the list of thousands follows a moment behind the field.
  const query = useDeferredValue(typed);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const brands = useMemo(() => groupByBrand(searchKeyboards(bundledKeyboards, query)), [query]);
  const found = brands.reduce((count, group) => count + group.keyboards.length, 0);
  const searching = query.trim() !== '';

  return (
    <div className="container page">
      <header>
        <p className="eyebrow">Supported keyboards</p>
        <h1 className="section__title">
          <span className="hl">{plural(bundledKeyboards.length, 'keyboard')}</span> from{' '}
          {plural(allBrands.length, 'brand')}.
        </h1>
        <p className="section__lead">
          These are recognised the moment you connect them. Click one to open a virtual copy and
          look around.
        </p>
      </header>

      <div className="card catalog__add">
        <p>
          <strong>Not listed?</strong> Any VIA keyboard works with its definition file. Try the file
          here: a virtual copy opens, and the real keyboard is recognised in this browser from then
          on. <a href="#/contribute">How to add it for everyone.</a>
        </p>
        <TryFileButton onTryFile={onTryFile} />
      </div>

      <div className="catalog__tools">
        <label className="field field--search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Search brand or model: keychron q1, iris, planck…"
            aria-label="Search brand or model"
          />
        </label>
        <p className="catalog__count" role="status">
          {searching
            ? `${plural(found, 'keyboard')} in ${plural(brands.length, 'brand')}`
            : 'Brands A to Z'}
        </p>
      </div>

      {!searching && (
        <nav className="chips" aria-label="Jump to brands by first letter">
          {letters.map(([letter, start]) => (
            <button
              key={letter}
              type="button"
              className="chip"
              title={`${plural(start.brands, 'brand')}, from ${start.brand}`}
              onClick={() => document.getElementById(brandAnchor(start.brand))?.scrollIntoView()}
            >
              {letter}
              <span className="chip__note">{start.brands}</span>
            </button>
          ))}
        </nav>
      )}

      {brands.length === 0 ? (
        <p className="card">
          No built-in keyboard matches “{query.trim()}”. It can still work: use{' '}
          <strong>Try a definition file</strong> above.
        </p>
      ) : (
        brands.map((group) => (
          <section key={group.brand} id={brandAnchor(group.brand)} className="brand">
            <h2 className="brand__name">
              {group.brand}
              <span className="tag">{plural(group.keyboards.length, 'keyboard')}</span>
            </h2>
            <ul className="boards">
              {group.keyboards.map((keyboard) => (
                <li key={keyboard.path}>
                  <button
                    type="button"
                    className="boards__item"
                    title={`Open a virtual ${keyboard.name}`}
                    onClick={() => onPreview(keyboard.path)}
                  >
                    {keyboard.model}
                    <code>{deviceKey(keyboard.vendorId, keyboard.productId)}</code>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
