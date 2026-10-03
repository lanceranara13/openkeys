import { Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { Keycode, KeycodeCatalog } from '../core/keycodes';

interface Props {
  catalog: KeycodeCatalog;
  /** Keycode of the selected key, highlighted in the list. */
  current?: number;
  /** False until a key is selected on the keyboard. */
  enabled: boolean;
  onPick: (code: number) => void;
}

export function KeycodePicker({ catalog, current, enabled, onPick }: Props) {
  const [groupId, setGroupId] = useState(catalog.groups[0].id);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState(false);

  const group = catalog.groups.find((item) => item.id === groupId) ?? catalog.groups[0];
  const search = query.trim().toLowerCase();

  const keycodes = useMemo<Keycode[]>(() => {
    if (!search) return group.keycodes;
    return catalog.groups
      .flatMap((item) => item.keycodes)
      .filter((keycode) =>
        [keycode.label, keycode.name, keycode.title].some((text) => text.toLowerCase().includes(search)),
      );
  }, [catalog, group, search]);

  const applyCustom = (event: FormEvent) => {
    event.preventDefault();
    const code = catalog.parse(custom);
    setCustomError(code === undefined);
    if (code !== undefined) {
      onPick(code);
      setCustom('');
    }
  };

  return (
    <div className={`picker${enabled ? '' : ' picker--disabled'}`}>
      <div className="picker__toolbar">
        <label className="field field--search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys: volume, F5, layer…"
            aria-label="Search keys"
          />
        </label>
        <form className="picker__custom" onSubmit={applyCustom}>
          <input
            className={`field__input${customError ? ' field__input--error' : ''}`}
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value);
              setCustomError(false);
            }}
            placeholder="Any code: KC_F13 or 0x5221"
            aria-label="QMK keycode name or hex value"
            aria-invalid={customError}
            disabled={!enabled}
          />
          <button type="submit" className="btn btn--ghost btn--sm" disabled={!enabled || !custom.trim()}>
            Set
          </button>
        </form>
      </div>

      {!search && (
        <div className="chips" role="tablist" aria-label="Key categories">
          {catalog.groups.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === group.id}
              className={`chip${item.id === group.id ? ' chip--active' : ''}`}
              onClick={() => setGroupId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {!search && group.hint && <p className="picker__hint">{group.hint}</p>}
      {customError && (
        <p className="picker__hint picker__hint--error">
          “{custom}” is not a keycode this keyboard knows. Use a QMK name or a hex value.
        </p>
      )}

      {keycodes.length === 0 ? (
        <p className="picker__empty">No key matches “{query}”.</p>
      ) : (
        <div className="picker__grid">
          {keycodes.map((keycode) => (
            <button
              key={keycode.code}
              type="button"
              className={`keycode${keycode.code === current ? ' keycode--current' : ''}${keycode.label.length > 6 ? ' keycode--long' : ''}`}
              title={`${keycode.title} (${keycode.name})`}
              disabled={!enabled}
              onClick={() => onPick(keycode.code)}
            >
              {keycode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
