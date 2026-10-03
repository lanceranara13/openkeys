import { useEffect, useState } from 'react';

export type Route = 'home' | 'configure';

// "#/configure" is the configurator. Every other hash ("#keyboards", ...) is a
// section of the landing page, which the browser scrolls to by itself.
const readRoute = (): Route =>
  window.location.hash.startsWith('#/configure') ? 'configure' : 'home';

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
