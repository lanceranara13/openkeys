import { Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReadySession, Session } from '../app/useSession';
import { deviceKey } from '../core/definition';

interface Props {
  session: Session;
  ready: ReadySession;
}

export function DevicePanel({ session, ready }: Props) {
  const { definition, device, info, layoutSelection } = ready;
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const facts: [string, string][] = [
    ['Keyboard', definition.name],
    ['USB id', deviceKey(device.vendorId, device.productId)],
    ['Firmware protocol', `${info.protocolName} ${info.protocolVersion}`],
    ['Layers', String(info.layerCount)],
    ['Matrix', `${definition.matrix.rows} rows × ${definition.matrix.cols} columns`],
  ];

  return (
    <div className="settings">
      <section className="settings__section">
        <h3 className="settings__title">About this keyboard</h3>
        <dl className="facts">
          {facts.map(([name, value]) => (
            <div key={name} className="facts__row">
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {definition.layoutOptions.length > 0 && (
        <section className="settings__section">
          <h3 className="settings__title">Physical layout</h3>
          <p className="settings__note">
            Match the picture to how your keyboard is built. This only changes what is drawn.
          </p>
          {definition.layoutOptions.map((option, group) => (
            <label key={option.label} className="control">
              <span className="control__label">{option.label}</span>
              <select
                className="select"
                value={layoutSelection[group] ?? 0}
                onChange={(event) => session.setLayoutOption(group, Number(event.target.value))}
              >
                {option.choices.map((choice, index) => (
                  <option key={choice} value={index}>
                    {choice}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      <section className="settings__section">
        <h3 className="settings__title">Backup</h3>
        <p className="settings__note">
          Save every layer to a file, or load a file you saved earlier from this keyboard.
        </p>
        <div className="settings__actions">
          <button type="button" className="btn btn--ghost" onClick={session.exportBackup}>
            <Download size={16} aria-hidden /> Export backup
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={session.busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} aria-hidden /> Import backup
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
              if (file) void session.importBackup(file);
            }}
          />
        </div>
      </section>

      <section className="settings__section">
        <h3 className="settings__title">Reset</h3>
        <p className="settings__note">
          Puts every key on every layer back to how the keyboard shipped. Export a backup first if
          you may want your layout back.
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
                  void session.resetKeymap();
                }}
              >
                Yes, reset every key
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={session.busy}
              onClick={() => setConfirmingReset(true)}
            >
              <RotateCcw size={16} aria-hidden /> Reset keymap
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
