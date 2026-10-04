import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openConfigurator, useHashRoute } from './app/useHashRoute';
import { useSession, type Notice } from './app/useSession';
import { useTheme } from './app/useTheme';
import { Configurator } from './components/Configurator';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { KeyboardsPage } from './components/KeyboardsPage';
import { Landing } from './components/Landing';

const TOAST_MS = { ok: 3500, error: 9000 };

function Toast({ notice }: { notice: Notice | null }) {
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setDismissed(notice.id), TOAST_MS[notice.kind]);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice || notice.id === dismissed) return null;
  return (
    <button
      type="button"
      className={`toast toast--${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      title="Dismiss"
      onClick={() => setDismissed(notice.id)}
    >
      {notice.kind === 'ok' ? <CircleCheck size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}
      {notice.text}
    </button>
  );
}

export default function App() {
  const route = useHashRoute();
  const session = useSession();
  const { theme, toggle } = useTheme();
  const { state } = session;

  return (
    <>
      <Header
        route={route}
        deviceName={state.status === 'ready' ? state.definition.name : null}
        theme={theme}
        onToggleTheme={toggle}
      />
      <main>
        {route === 'home' && (
          <Landing
            onConnect={() => {
              openConfigurator();
              void session.connect();
            }}
            onDemo={() => {
              openConfigurator();
              void session.connectDemo();
            }}
          />
        )}
        {route === 'keyboards' && (
          <KeyboardsPage
            onPreview={(path) => {
              openConfigurator();
              void session.connectPreview(path);
            }}
            onTryFile={(file) => {
              // A file with a problem keeps the user here, next to the message about it.
              void session.previewFile(file).then((good) => {
                if (good) openConfigurator();
              });
            }}
          />
        )}
        {route === 'configure' && <Configurator session={session} />}
      </main>
      <Footer />
      <Toast notice={session.notice} />
    </>
  );
}
