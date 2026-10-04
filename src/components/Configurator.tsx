import { Unplug } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReadySession, Session } from '../app/useSession';
import { deviceKey } from '../core/definition';
import { resolveLayout } from '../core/kle';
import { bytesToNumber, type MenuControl } from '../core/menus';
import { ConnectPanel } from './ConnectPanel';
import { DevicePanel } from './DevicePanel';
import { KeyboardView, keymapLegend } from './KeyboardView';
import { KeycodePicker } from './KeycodePicker';
import { MenuPanel } from './MenuPanel';
import { SwitchesPanel } from './SwitchesPanel';

const STEPS = ['Pick a layer', 'Click a key', 'Choose what it does'];

/** Colour of the light under the keyboard picture, taken from its lighting settings. */
function glowColor(controls: MenuControl[], values: Record<string, number[]>): string | undefined {
  const color = controls.find((control) => control.type === 'color' && values[control.ref.key]);
  if (!color) return undefined;

  const sibling = (suffix: string) => {
    const control = controls.find(
      (item) => item.ref.channel === color.ref.channel && item.ref.id.endsWith(suffix),
    );
    return control && values[control.ref.key]?.[0];
  };
  // Lighting switched off: fall back to the plain shadow.
  if (sibling('_effect') === 0) return undefined;

  const [hue, sat] = values[color.ref.key];
  const strength = (sibling('_brightness') ?? 255) / 255;
  return `hsl(${(hue / 255) * 360} ${(sat / 255) * 100}% 50% / ${0.25 + 0.65 * strength})`;
}

function Workspace({ session, ready }: { session: Session; ready: ReadySession }) {
  const { definition, device, info, keymap, values, layoutSelection, analog } = ready;
  const { cols } = definition.matrix;

  const [tab, setTab] = useState('keymap');
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  const layout = useMemo(
    () => resolveLayout(definition.layout, layoutSelection),
    [definition, layoutSelection],
  );
  const controls = useMemo(
    () => definition.menus.flatMap((menu) => menu.sections.flatMap((section) => section.controls)),
    [definition],
  );
  const lookup = useCallback(
    (id: string) => {
      const control = controls.find((item) => item.ref.id === id);
      const bytes = control && values[control.ref.key];
      if (!bytes) return undefined;
      return control.type === 'color' ? bytes[0] : bytesToNumber(bytes);
    },
    [controls, values],
  );

  const selectedCode = selected ? keymap[layer][selected.row * cols + selected.col] : undefined;
  const selectedKey = selectedCode === undefined ? undefined : info.catalog.describe(selectedCode);
  const activeStep = selected ? 2 : 1;
  const menu = definition.menus.find((item) => `menu:${item.label}` === tab);

  const glow = glowColor(controls, values);

  const tabs = [
    { id: 'keymap', label: 'Keymap' },
    // Only keyboards with magnetic switches OpenKeys can configure get this tab.
    ...(analog && info.analog ? [{ id: 'switches', label: 'Switches' }] : []),
    ...definition.menus.map((item) => ({ id: `menu:${item.label}`, label: item.label })),
    { id: 'device', label: 'Keyboard' },
  ];

  return (
    <div className="container page">
      <div className="devicebar card">
        <div className="devicebar__name">
          <span className="status__dot" aria-hidden />
          <h1>{definition.name}</h1>
        </div>
        <div className="devicebar__meta">
          {device.virtual && <span className="tag tag--accent">Virtual · no real hardware</span>}
          <span className="tag">
            {info.protocolName} {info.protocolVersion}
          </span>
          <span className="tag">
            {info.layerCount} {info.layerCount === 1 ? 'layer' : 'layers'}
          </span>
          <span className="tag">{deviceKey(device.vendorId, device.productId)}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void session.disconnect()}>
          <Unplug size={15} aria-hidden /> Disconnect
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Configurator sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tabs__tab${tab === item.id ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'keymap' && (
        <>
          <ol className="steps-bar">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className={`steps-bar__step${index === activeStep ? ' steps-bar__step--active' : ''}${index < activeStep ? ' steps-bar__step--done' : ''}`}
              >
                <span className="steps-bar__number">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <div className="layers" role="tablist" aria-label="Layers">
            {keymap.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={layer === index}
                className={`chip${layer === index ? ' chip--active' : ''}`}
                onClick={() => setLayer(index)}
              >
                Layer {index}
                {index === 0 && <span className="chip__note">base</span>}
              </button>
            ))}
          </div>

          <KeyboardView
            layout={layout}
            legend={keymapLegend(keymap[layer], cols, info.catalog.describe)}
            isSelected={(key) => selected?.row === key.row && selected.col === key.col}
            onSelect={(key) =>
              setSelected((current) =>
                current?.row === key.row && current.col === key.col
                  ? null
                  : { row: key.row, col: key.col },
              )
            }
            glow={glow}
          />

          <div className="panel card">
            <p className="panel__status">
              {selected && selectedKey ? (
                <>
                  This key is <strong>{selectedKey.title}</strong> on layer {layer}. Pick its
                  replacement below. It is saved to the keyboard straight away.
                </>
              ) : (
                <>Click a key on the keyboard above to change it.</>
              )}
            </p>
            <KeycodePicker
              catalog={info.catalog}
              current={selectedCode}
              enabled={selected !== null}
              onPick={(code) => {
                if (selected) void session.setKeycode(layer, selected.row, selected.col, code);
              }}
            />
          </div>
        </>
      )}

      {tab === 'switches' && analog && info.analog && (
        <SwitchesPanel
          session={session}
          analog={analog}
          support={info.analog}
          layout={layout}
          cols={cols}
          baseLegend={keymapLegend(keymap[0], cols, info.catalog.describe)}
          glow={glow}
        />
      )}

      {menu && (
        <div className="panel card">
          <MenuPanel
            menu={menu}
            values={values}
            lookup={lookup}
            onChange={(control, bytes) => void session.setValue(control, bytes)}
          />
        </div>
      )}

      {tab === 'device' && (
        <div className="panel card">
          <DevicePanel session={session} ready={ready} />
        </div>
      )}
    </div>
  );
}

export function Configurator({ session }: { session: Session }) {
  const { state } = session;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (state.status !== 'ready') {
    return (
      <div className="container page page--narrow">
        <ConnectPanel session={session} />
      </div>
    );
  }
  // Keyed so that connecting a different keyboard starts with a clean selection.
  return (
    <Workspace
      key={deviceKey(state.device.vendorId, state.device.productId)}
      session={session}
      ready={state}
    />
  );
}
