import Mustache from 'mustache';

import type { TemplateVariable } from './index';

/** A parsed Mustache token: [type, value, start, end, children?, …]. */
type Token = [string, string, number, number, Token[]?, ...unknown[]];

/**
 * Top-level variables in a template body, in first-use order, so a form can be built for them.
 * Throws Mustache's own error if the body isn't valid (e.g. an unclosed section).
 */
export function templateVariables(body: string): TemplateVariable[] {
  const found = new Map<string, TemplateVariable>();

  for (const [type, name, , , children] of Mustache.parse(body) as Token[]) {
    if (found.has(name)) {
      continue;
    }

    if (type === 'name' || type === '&') {
      found.set(name, { name, kind: 'text' });
    }

    if (type === '#' || type === '^') {
      const repeats = children?.some(([childType, childName]) => childType === 'name' && childName === '.');

      found.set(name, { name, kind: repeats ? 'list' : 'flag' });
    }
  }

  return [...found.values()];
}
