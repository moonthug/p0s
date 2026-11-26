import { P0sError } from '@moonthug/p0s-client';

/** A message fit to show: the API's own words when it gave some, otherwise the fallback. */
export function errorMessage(error: unknown, fallback: string): string | null {
  if (!error) {
    return null;
  }

  return error instanceof P0sError ? error.message : fallback;
}
