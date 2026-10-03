import type { CSSProperties } from 'react';
import { bytesToNumber, numberToBytes, valueSize, type Menu, type MenuControl } from '../core/menus';
import { evaluateShowIf } from '../core/showif';

interface Props {
  menu: Menu;
  values: Record<string, number[]>;
  /** Current value of a control by its id, for `showIf` expressions. */
  lookup: (id: string) => number | undefined;
  onChange: (control: MenuControl, bytes: number[]) => void;
}

/** QMK stores hue and saturation as 0-255. */
const hsl = (hue: number, sat: number) => `hsl(${(hue / 255) * 360} ${(sat / 255) * 100}% 55%)`;

function Control({ control, bytes, onChange }: { control: MenuControl; bytes: number[]; onChange: Props['onChange'] }) {
  const value = bytesToNumber(bytes);

  switch (control.type) {
    case 'range':
      return (
        <label className="control">
          <span className="control__label">{control.label}</span>
          <input
            type="range"
            className="range"
            min={control.min}
            max={control.max}
            value={value}
            onChange={(event) =>
              onChange(control, numberToBytes(Number(event.target.value), valueSize(control)))
            }
          />
          <output className="control__value">{value}</output>
        </label>
      );

    case 'dropdown':
      return (
        <label className="control">
          <span className="control__label">{control.label}</span>
          <select
            className="select"
            value={value}
            onChange={(event) => onChange(control, [Number(event.target.value)])}
          >
            {/* The keyboard may hold a value the definition does not list. */}
            {!control.choices.some((choice) => choice.value === value) && (
              <option value={value}>Unknown ({value})</option>
            )}
            {control.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      );

    case 'toggle': {
      const on = value !== control.off;
      return (
        <div className="control">
          <span className="control__label">{control.label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={control.label}
            className={`switch${on ? ' switch--on' : ''}`}
            onClick={() => onChange(control, [on ? control.off : control.on])}
          />
        </div>
      );
    }

    case 'color': {
      const [hue = 0, sat = 0] = bytes;
      return (
        <div className="control control--color">
          <span className="control__label">{control.label}</span>
          <div className="color">
            <span className="color__swatch" style={{ background: hsl(hue, sat) }} />
            <div className="color__sliders">
              <input
                type="range"
                className="range range--hue"
                min={0}
                max={255}
                value={hue}
                aria-label={`${control.label} hue`}
                onChange={(event) => onChange(control, [Number(event.target.value), sat])}
              />
              <input
                type="range"
                className="range range--sat"
                style={{ '--hue-color': hsl(hue, 255) } as CSSProperties}
                min={0}
                max={255}
                value={sat}
                aria-label={`${control.label} saturation`}
                onChange={(event) => onChange(control, [hue, Number(event.target.value)])}
              />
            </div>
          </div>
        </div>
      );
    }
  }
}

export function MenuPanel({ menu, values, lookup, onChange }: Props) {
  const sections = menu.sections
    .filter((section) => evaluateShowIf(section.showIf, lookup))
    .map((section) => ({
      ...section,
      // A control without a value is one the firmware does not have.
      controls: section.controls.filter(
        (control) => values[control.ref.key] && evaluateShowIf(control.showIf, lookup),
      ),
    }))
    .filter((section) => section.controls.length > 0);

  if (sections.length === 0) {
    return (
      <p className="panel__empty">
        This keyboard’s firmware did not report any {menu.label.toLowerCase()} settings.
      </p>
    );
  }

  return (
    <div className="settings">
      {sections.map((section) => (
        <section key={section.label} className="settings__section">
          <h3 className="settings__title">{section.label}</h3>
          {section.controls.map((control) => (
            <Control
              key={control.ref.key}
              control={control}
              bytes={values[control.ref.key]}
              onChange={onChange}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
