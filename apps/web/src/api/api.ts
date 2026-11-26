import { P0sClient } from '@moonthug/p0s-client';

/** The app's API client: the published `@moonthug/p0s-client`, through the same-origin `/api` proxy. */
export const api = new P0sClient(`${window.location.origin}/api`);
