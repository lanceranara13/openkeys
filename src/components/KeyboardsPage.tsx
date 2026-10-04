import { FileJson, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deviceKey } from '../core/definition';
import { groupByBrand, searchKeyboards } from '../core/keyboard-list';
import { bundledKeyboards } from '../core/registry';

interface Props {
  /** Opens a virtual copy of a built-in keyboard, by its path in `keyboards/`. */
  onPreview: (path: string) => void;
  /** Checks a definition file and opens a virtual copy of the keyboard it describes. */
  onTryFile: (file: File) => void;
}

const allBrands = groupByBrand(bundledKeyboards);

const brandAnchor = (brand: string) => `brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Every built-in keyboard, by brand, with a search across brand, model and USB id. */
export function KeyboardsPage({ onPreview, onTryFile }: Props) {
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

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
          on. <a href="#add">How to add it for everyone.</a>
        </p>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          <FileJson size={16} aria-hidden /> Try a definition file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear the input so picking the same file again fires a change.
            event.target.value = '';
            if (file) onTryFile(file);
          }}
        />
      </div>

      <div className="catalog__tools">
        <label className="field field--search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
        <nav className="chips" aria-label="Jump to a brand">
          {allBrands.map((group) => (
            <button
              key={group.brand}
              type="button"
              className="chip"
              onClick={() => document.getElementById(brandAnchor(group.brand))?.scrollIntoView()}
            >
              {group.brand}
              <span className="chip__note">{group.keyboards.length}</span>
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
