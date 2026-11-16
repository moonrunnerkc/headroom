import type { HeadroomApi } from '../shared/headroom-api';

declare global {
  interface Window {
    readonly headroom?: HeadroomApi;
  }
}

/** The preload bridge; its absence means the page is not running inside Headroom. */
export function bridge(): HeadroomApi {
  const api = window.headroom;
  if (api === undefined)
    throw new Error('Headroom bridge unavailable: the page is not running in the app.');
  return api;
}
