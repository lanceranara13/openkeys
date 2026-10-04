import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { Session } from '../app/useSession';
import type { KeyGeometry, ResolvedLayout } from '../core/kle';
import type { AnalogState, AnalogSupport, TravelSettings } from '../drivers/types';
import { KeyboardView, type KeyLegend } from './KeyboardView';

interface Props {
  session: Session;
  analog: AnalogState;
  support: AnalogSupport;
  layout: ResolvedLayout;
  /** Matrix columns, to find a key's settings in `analog.keys`. */
  cols: number;
  /** What each key sends on the base layer, so the keys can be recognised. */
  baseLegend: (key: KeyGeometry) => KeyLegend;
  glow?: string;
}

/** Distances are stored in tenths of a millimetre. */
const millimetres = (tenths: number) => `${(tenths / 10).toFixed(1)} mm`;
const keyId = (key: { row: number; col: number }) => `${key.row},${key.col}`;
const clamp = (value: number, [min, max]: [number, number]) => Math.min(max, Math.max(min, value));

/** Magnetic switch settings: actuation point and rapid trigger, for all keys or chosen ones. */
export function SwitchesPanel({ session, analog, support, layout, cols, baseLegend, glow }: Props) {
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Two drawn keys can share a matrix position; each position is listed once.
  const wired = [...new Map(layout.keys.filter((key) => key.row >= 0).map((key) => [keyId(key), key])).values()];
  const selected = wired.filter((key) => selection.has(keyId(key)));
  const forAllKeys = selected.length === 0;

  const own = forAllKeys ? null : analog.keys[selected[0].row * cols + selected[0].col];
  const shown = own ?? analog.global;

  const apply = (change: Partial<TravelSettings>) => {
    const settings = { ...shown, ...change };
    if (forAllKeys) void session.setGlobalTravel(settings);
    else void session.setKeyTravel(selected, settings);
  };

  const toggleKey = (key: KeyGeometry) => {
    // Built from the latest selection, so quick clicks in a row all count.
    setSelection((current) => {
      const next = new Set(current);
      if (!next.delete(keyId(key))) next.add(keyId(key));
      return next;
    });
  };

  const legend = (key: KeyGeometry): KeyLegend => {
    const ownSettings = analog.keys[key.row * cols + key.col];
    const travel = ownSettings ?? analog.global;
    const { label } = baseLegend(key);
    return {
      label,
      sub: `${(travel.actuation / 10).toFixed(1)}${travel.rapidTrigger ? ' RT' : ''}`,
      title:
        `${label}: registers at ${millimetres(travel.actuation)}` +
        (travel.rapidTrigger ? ', rapid trigger on' : '') +
        (ownSettings ? ' (own settings)' : ''),
      marked: ownSettings !== null,
    };
  };

  const distance = (
    label: string,
    field: 'actuation' | 'pressSensitivity' | 'releaseSensitivity',
    limits: [number, number],
  ) => (
    <label className="control">
      <span className="control__label">{label}</span>
      <input
        type="range"
        className="range"
        min={limits[0]}
        max={limits[1]}
        value={clamp(shown[field], limits)}
        onChange={(event) => apply({ [field]: Number(event.target.value) })}
      />
      <output className="control__value">{millimetres(shown[field])}</output>
    </label>
  );

  return (
    <>
      <p className="callout callout--warn">
        <TriangleAlert size={18} aria-hidden />
        <span>
          Switch settings are new. They follow Keychron’s published firmware and are tested against
          an emulator, not yet on every keyboard. If keys start behaving oddly, use{' '}
          <strong>Reset switches</strong> below.
        </span>
      </p>

      {analog.profileCount > 1 && (
        <div className="layers" role="tablist" aria-label="Switch profiles">
          {Array.from({ length: analog.profileCount }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={analog.profile === index}
              className={`chip${analog.profile === index ? ' chip--active' : ''}`}
              disabled={session.busy}
              onClick={() => void session.selectSwitchProfile(index)}
            >
              Profile {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="switches__bar">
        <p>
          Click keys to change only those. With no key selected, changes apply to{' '}
          <strong>all keys</strong>. Each key shows how far it travels before it registers;{' '}
          <strong>RT</strong> marks rapid trigger.
        </p>
        <div className="settings__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setSelection(new Set(wired.map(keyId)))}
          >
            Select all
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={forAllKeys}
            onClick={() => setSelection(new Set())}
          >
            Clear selection
          </button>
        </div>
      </div>

      <KeyboardView
        layout={layout}
        legend={legend}
        isSelected={(key) => selection.has(keyId(key))}
        onSelect={toggleKey}
        glow={glow}
      />

      <div className="panel card">
        <div className="settings">
          <section className="settings__section">
            <h3 className="settings__title">
              {forAllKeys
                ? 'All keys'
                : `${selected.length} selected key${selected.length === 1 ? '' : 's'}`}
            </h3>
            <p className="settings__note">
              {forAllKeys
                ? 'These settings apply to every key that has none of its own.'
                : own
                  ? 'These keys have their own settings.'
                  : 'These keys follow the all-keys settings. Change anything here to give them their own.'}
            </p>

            {distance('Actuation point', 'actuation', support.limits.actuation)}

            <div className="control">
              <span className="control__label">Rapid trigger</span>
              <button
                type="button"
                role="switch"
                aria-checked={shown.rapidTrigger}
                aria-label="Rapid trigger"
                className={`switch${shown.rapidTrigger ? ' switch--on' : ''}`}
                onClick={() => apply({ rapidTrigger: !shown.rapidTrigger })}
              />
            </div>
            {shown.rapidTrigger && (
              <>
                {distance('Press again after', 'pressSensitivity', support.limits.sensitivity)}
                {distance('Release after', 'releaseSensitivity', support.limits.sensitivity)}
              </>
            )}
            <p className="settings__note settings__note--after">
              The actuation point is how far down a key travels before it registers. With rapid
              trigger a key lets go as soon as it moves up by the release distance, and registers
              again as soon as it moves down by the press distance, wherever it is.
            </p>

            {own && (
              <div className="settings__actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void session.setKeyTravel(selected, null)}
                >
                  Use the all-keys settings
                </button>
              </div>
            )}
          </section>

          <section className="settings__section">
            <h3 className="settings__title">Reset</h3>
            <p className="settings__note">
              Puts every switch setting of profile {analog.profile + 1} back to how the keyboard
              shipped. The keymap is not touched.
            </p>
            <div className="settings__actions">
              {confirmingReset ? (
                <>
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={session.busy}
                    onClick={() => {
                      setConfirmingReset(false);
                      setSelection(new Set());
                      void session.resetSwitches();
                    }}
                  >
                    Yes, reset the switches
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirmingReset(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={session.busy}
                  onClick={() => setConfirmingReset(true)}
                >
                  <RotateCcw size={16} aria-hidden /> Reset switches
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
