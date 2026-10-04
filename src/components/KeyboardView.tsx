import type { CSSProperties } from 'react';
import type { Keycode } from '../core/keycodes';
import { KC_NO, KC_TRNS } from '../core/keycodes';
import type { KeyGeometry, ResolvedLayout } from '../core/kle';

/** What is printed on one key. */
export interface KeyLegend {
  label: string;
  /** Smaller second line, e.g. a switch's actuation point. */
  sub?: string;
  /** Tooltip. */
  title?: string;
  /** Greys the label out. */
  dim?: boolean;
  /** Makes the second line stand out, for keys that differ from the rest. */
  marked?: boolean;
}

interface Props {
  layout: ResolvedLayout;
  /** Says what to print on a key that is wired to the matrix. */
  legend: (key: KeyGeometry) => KeyLegend;
  isSelected?: (key: KeyGeometry) => boolean;
  /** Makes the keys clickable. Without it the keyboard is just a picture. */
  onSelect?: (key: KeyGeometry) => void;
  /** CSS colour of the light under the keyboard. */
  glow?: string;
}

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

const hasSecondRect = (key: KeyGeometry) =>
  key.x2 !== 0 || key.y2 !== 0 || key.w2 !== key.w || key.h2 !== key.h;

/** The legend of a keymap layer: what each key sends. */
export function keymapLegend(
  keycodes: number[],
  cols: number,
  describe: (code: number) => Keycode,
): (key: KeyGeometry) => KeyLegend {
  return (key) => {
    const code = keycodes[key.row * cols + key.col];
    const keycode = describe(code);
    return {
      label: keycode.label,
      title: `${keycode.title} (${keycode.name})`,
      dim: code === KC_NO || code === KC_TRNS,
    };
  };
}

export function KeyboardView({ layout, legend, isSelected, onSelect, glow }: Props) {
  const { keys, width, height } = layout;

  return (
    <div className="board" style={glow ? ({ '--glow': glow } as CSSProperties) : undefined}>
      <div
        className="board__keys"
        style={{ aspectRatio: `${width} / ${height}`, '--units': width } as CSSProperties}
      >
        {keys.map((key) => {
          // An encoder without a switch has no matrix position and nothing to configure.
          const wired = key.row >= 0;
          const text: KeyLegend = wired ? legend(key) : { label: '⟳' };
          const selected = wired && (isSelected?.(key) ?? false);

          const className = [
            'key',
            `key--${key.color}`,
            key.encoder !== undefined && 'key--encoder',
            text.dim && 'key--dim',
            text.label.length > 5 && 'key--long',
            text.marked && 'key--marked',
            selected && 'key--selected',
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
                <span className="key__label">{text.label}</span>
                {text.sub && <span className="key__sub">{text.sub}</span>}
              </span>
            </>
          );

          return onSelect && wired ? (
            <button
              key={key.id}
              type="button"
              className={className}
              style={style}
              title={text.title}
              aria-pressed={selected}
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
