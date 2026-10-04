import { useEffect, useState } from 'react';

export type Route = 'home' | 'configure' | 'keyboards' | 'contribute';

// "#/configure" is the configurator, "#/keyboards" the list of supported keyboards
// and "#/contribute" the guide to adding one. Every other hash ("#how", ...) is a
// section of the landing page, which the browser scrolls to by itself.
function readRoute(): Route {
  const { hash } = window.location;
  if (hash.startsWith('#/configure')) return 'configure';
  if (hash.startsWith('#/keyboards')) return 'keyboards';
  if (hash.startsWith('#/contribute')) return 'contribute';
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
