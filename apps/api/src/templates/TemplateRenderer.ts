import Mustache from 'mustache';

import { type TemplateVariable, type TemplateVars, templateVariables } from '@p0s/shared';

import { ReceiptRenderer } from '../ReceiptRenderer';
import { TemplateSyntaxError } from './TemplateSyntaxError';

/**
 * Fills a template's Mustache tags to produce a ReceiptLine document.
 * `{{var}}` is escaped for ReceiptLine, so values can't break the layout; `{{{var}}}` inserts raw markup.
 */
export class TemplateRenderer {
  render(body: string, vars: TemplateVars): string {
    try {
      return Mustache.render(body, vars, {}, { escape: ReceiptRenderer.escape });
    } catch (err) {
      throw new TemplateSyntaxError(err);
    }
  }

  /** Top-level variables in the body, for building a form. */
  variables(body: string): TemplateVariable[] {
    try {
      return templateVariables(body);
    } catch (err) {
      throw new TemplateSyntaxError(err);
    }
  }
}
