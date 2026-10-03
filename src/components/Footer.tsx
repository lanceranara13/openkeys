function External({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** Credits and license, on every page. CREDITS.md has the full list. */
export function Footer() {
  return (
    <footer className="footer container">
      <p className="footer__credits">
        Built on <External href="https://github.com/qmk/qmk_firmware">QMK</External> and the{' '}
        <External href="https://github.com/the-via/keyboards">VIA</External> keyboard definitions.
        Layout format from{' '}
        <External href="https://github.com/ijprest/keyboard-layout-editor">
          Keyboard Layout Editor
        </External>
        . Type is <External href="https://github.com/IBM/plex">IBM Plex</External>, icons are{' '}
        <External href="https://github.com/lucide-icons/lucide">Lucide</External>. Design reference
        from{' '}
        <External href="https://github.com/VoltAgent/awesome-design-md">awesome-design-md</External>
        . Idea from{' '}
        <External href="https://github.com/OpenMouse-Project/openmouse">OpenMouse</External>. The
        full list, with licenses, is in <code>CREDITS.md</code>.
      </p>
      <p className="footer__meta">
        <span>OpenKeys · free software under GPL-3.0, no warranty</span>
        <span>Not affiliated with VIA, QMK or any keyboard maker.</span>
      </p>
    </footer>
  );
}
