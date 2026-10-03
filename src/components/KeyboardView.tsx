import type { CSSProperties } from 'react';
import type { Keycode } from '../core/keycodes';
import { KC_NO, KC_TRNS } from '../core/keycodes';
import type { KeyGeometry, ResolvedLayout } from '../core/kle';

interface Props {
  layout: ResolvedLayout;
  /** Matrix columns, to find a key's keycode in `keycodes`. */
  cols: number;
  /** Keycodes of the layer being shown, indexed by `row * cols + col`. */
  keycodes: number[];
  describe: (code: number) => Keycode;
  selected?: { row: number; col: number } | null;
  /** Makes the keys clickable. Without it the keyboard is just a picture. */
  onSelect?: (key: KeyGeometry) => void;
  /** CSS colour of the light under the keyboard. */
  glow?: string;
}

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

const hasSecondRect = (key: KeyGeometry) =>
  key.x2 !== 0 || key.y2 !== 0 || key.w2 !== key.w || key.h2 !== key.h;

export function KeyboardView({ layout, cols, keycodes, describe, selected, onSelect, glow }: Props) {
  const { keys, width, height } = layout;

  return (
    <div className="board" style={glow ? ({ '--glow': glow } as CSSProperties) : undefined}>
      <div
        className="board__keys"
        style={{ aspectRatio: `${width} / ${height}`, '--units': width } as CSSProperties}
      >
        {keys.map((key) => {
          const wired = key.row >= 0;
          const code = wired ? keycodes[key.row * cols + key.col] : undefined;
          const keycode = code === undefined ? undefined : describe(code);
          const label = keycode?.label ?? '';
          const isSelected = wired && selected?.row === key.row && selected.col === key.col;

          const className = [
            'key',
            `key--${key.color}`,
            key.encoder !== undefined && 'key--encoder',
            hasSecondRect(key) && 'key--compound',
            (code === KC_NO || code === KC_TRNS) && 'key--dim',
            label.length > 5 && 'key--long',
            isSelected && 'key--selected',
          ]
            .filter(Boolean)
            .join(' ');

          const style: CSSProperties = {
            left: percent(key.x, width),
            top: percent(key.y, height),
            width: percent(key.w, width),
            height: percent(key.h, height),
            ...(key.r !== 0 && {
              transform: `rotate(${key.r}deg)`,
              transformOrigin: `${percent(key.rx - key.x, key.w)} ${percent(key.ry - key.y, key.h)}`,
            }),
          };

          const caps = (
            <>
              {hasSecondRect(key) && (
                <span
                  className="key__cap key__cap--second"
                  style={
                    {
                      '--x2': percent(key.x2, key.w),
                      '--y2': percent(key.y2, key.h),
                      '--w2': percent(key.w2, key.w),
                      '--h2': percent(key.h2, key.h),
                    } as CSSProperties
                  }
                />
              )}
              <span className="key__cap">
                <span className="key__label">{wired ? label : '⟳'}</span>
              </span>
            </>
          );

          return onSelect && wired ? (
            <button
              key={key.id}
              type="button"
              className={className}
              style={style}
              title={keycode ? `${keycode.title} (${keycode.name})` : undefined}
              aria-pressed={isSelected}
              onClick={() => onSelect(key)}
            >
              {caps}
            </button>
          ) : (
            <div key={key.id} className={className} style={style}>
              {caps}
            </div>
          );
        })}
      </div>
    </div>
  );
}
