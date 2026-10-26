/**
 * Minimal hash router. Routes contain only content ids, never patient information.
 * Hash routing works on any static host and offline, with no server rewrites.
 */
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'presentation'; id: string }
  | { name: 'escalation'; id: string }
  | { name: 'browse' }
  | { name: 'system'; id: string }
  | { name: 'critical'; id: string }
  | { name: 'tools' }
  | { name: 'contacts' }
  | { name: 'settings' }
  | { name: 'problems' }
  | { name: 'not-found' };

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  const parts = path.split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (parts.length === 0) return { name: 'home' };
  if (parts.length === 1) {
    switch (a) {
      case 'browse':
        return { name: 'browse' };
      case 'tools':
        return { name: 'tools' };
      case 'contacts':
        return { name: 'contacts' };
      case 'settings':
        return { name: 'settings' };
      case 'problems':
        return { name: 'problems' };
    }
  }
  if (b && ID.test(b)) {
    if (a === 'p' && parts.length === 2) return { name: 'presentation', id: b };
    if (a === 'p' && parts.length === 3 && c === 'escalate') return { name: 'escalation', id: b };
    if (a === 'system' && parts.length === 2) return { name: 'system', id: b };
    if (a === 'critical' && parts.length === 2) return { name: 'critical', id: b };
  }
  return { name: 'not-found' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'presentation':
      return `#/p/${route.id}`;
    case 'escalation':
      return `#/p/${route.id}/escalate`;
    case 'system':
      return `#/system/${route.id}`;
    case 'critical':
      return `#/critical/${route.id}`;
    case 'not-found':
      return '#/';
    default:
      return `#/${route.name}`;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}

export function navigate(route: Route) {
  window.location.hash = hrefFor(route).slice(1);
}

export function goBack() {
  if (window.history.length > 1) window.history.back();
  else navigate({ name: 'home' });
}
