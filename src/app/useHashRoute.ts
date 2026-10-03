import { useEffect, useState } from 'react';

export type Route = 'home' | 'configure' | 'keyboards';

// "#/configure" is the configurator and "#/keyboards" the list of supported
// keyboards. Every other hash ("#how", ...) is a section of the landing page, which
// the browser scrolls to by itself.
function readRoute(): Route {
  const { hash } = window.location;
  if (hash.startsWith('#/configure')) return 'configure';
  if (hash.startsWith('#/keyboards')) return 'keyboards';
  return 'home';
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return route;
}

export function openConfigurator(): void {
  window.location.hash = '#/configure';
}
