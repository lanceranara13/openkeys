import { FileJson, Play, TriangleAlert, Unplug, Usb } from 'lucide-react';
import { useRef } from 'react';
import type { Session } from '../app/useSession';
import { deviceKey } from '../core/definition';
import { isWebHidSupported } from '../transports/webhid';

/** Shown in the configurator until a keyboard is connected and understood. */
export function ConnectPanel({ session }: { session: Session }) {
  const { state } = session;
  const fileInput = useRef<HTMLInputElement>(null);
  const supported = isWebHidSupported();
  const connecting = state.status === 'connecting';

  const definitionInput = (
    <input
      ref={fileInput}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0];
        // Clear the input so picking the same file again fires a change.
        event.target.value = '';
        if (file) void session.provideDefinition(file);
      }}
    />
  );

  if (state.status === 'needs-definition') {
    const { device } = state;
    return (
      <div className="connect card">
        <span className="icon-tile">
          <FileJson size={22} aria-hidden />
        </span>
        <h1 className="connect__title">One more step for this keyboard</h1>
        <p className="connect__lead">
          OpenKeys has no layout for <strong>{device.name}</strong>{' '}
          <code>{deviceKey(device.vendorId, device.productId)}</code> yet. Load its VIA definition
          file and it works right away. The file stays in this browser.
        </p>
        <div className="connect__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => fileInput.current?.click()}>
            <FileJson size={18} aria-hidden /> Load definition file
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => void session.disconnect()}>
            <Unplug size={18} aria-hidden /> Disconnect
          </button>
        </div>
        <p className="connect__help">
          Keyboard makers publish this file on their support page, usually called “VIA JSON”. Want
          it built in for everyone? <a href="#/contribute">See how to add a keyboard.</a>
        </p>
        {definitionInput}
      </div>
    );
  }

  return (
    <div className="connect card">
      <span className="icon-tile">
        <Usb size={22} aria-hidden />
      </span>
      <h1 className="connect__title">Connect your keyboard</h1>
      <ol className="ministeps">
        {/* The spans keep each sentence one flex item next to its number. */}
        <li>
          <span>Plug the keyboard in with a USB cable.</span>
        </li>
        <li>
          <span>
            Click <strong>Connect keyboard</strong> and pick it in the list your browser shows.
          </span>
        </li>
        <li>
          <span>Click any key on screen and choose what it should do.</span>
        </li>
      </ol>

      <div className="connect__actions">
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={!supported || connecting}
          onClick={() => void session.connect()}
        >
          <Usb size={18} aria-hidden /> {connecting ? 'Connecting…' : 'Connect keyboard'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--lg"
          disabled={connecting}
          onClick={() => void session.connectDemo()}
        >
          <Play size={18} aria-hidden /> Try the demo keyboard
        </button>
      </div>

      {!supported && (
        <p className="callout callout--warn">
          <TriangleAlert size={18} aria-hidden />
          <span>
            {window.isSecureContext
              ? 'This browser cannot talk to USB keyboards. Use Chrome, Edge, Opera or Brave on a computer. The demo keyboard works everywhere.'
              : 'Browsers only allow USB access on https:// pages or on localhost. Open this page that way to connect a keyboard. The demo keyboard works everywhere.'}
          </span>
        </p>
      )}

      <p className="connect__help">
        Keyboard does not show up or is not recognised?{' '}
        <button type="button" className="link" onClick={() => fileInput.current?.click()}>
          Load its VIA definition file
        </button>{' '}
        first, then connect.
      </p>
      {definitionInput}
    </div>
  );
}
