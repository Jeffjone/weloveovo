import 'server-only';
import { createGeniusClient } from './integrations/genius-client';

export function geniusConfigured() {
  return Boolean(process.env.GENIUS_ACCESS_TOKEN?.trim());
}

// Import this module from server components, route handlers, or server scripts only.
// Read lazily so an unconfigured integration never prevents the site from starting.
export function geniusClient() {
  return createGeniusClient(process.env.GENIUS_ACCESS_TOKEN || '');
}
export { GeniusError, type GeniusSong } from './integrations/genius-client';
