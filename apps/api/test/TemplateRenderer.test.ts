import { describe, expect, it } from 'vitest';

import { TemplateRenderer } from '../src/templates/TemplateRenderer';
import { TemplateSyntaxError } from '../src/templates/TemplateSyntaxError';

const templates = new TemplateRenderer();

describe('TemplateRenderer.render', () => {
  it('fills in blanks, lists and sections', () => {
    const body = '{{title}}\n{{#items}}\n- {{.}}\n{{/items}}\n{{^items}}\nEmpty\n{{/items}}';

    expect(templates.render(body, { title: 'List', items: ['a', 'b'] })).toBe('List\n- a\n- b\n');
    expect(templates.render(body, { title: 'List', items: [] })).toBe('List\nEmpty\n');
  });

  it('escapes values so they cannot break the layout', () => {
    expect(templates.render('|{{dish}} | {{price}}|', { dish: 'Fish | chips', price: '£9' })).toBe(
      '|Fish \\| chips | £9|',
    );
  });

  it('inserts triple-brace values as raw markup', () => {
    expect(templates.render('{{{note}}}', { note: '"Bold"' })).toBe('"Bold"');
  });

  it('keeps ReceiptLine properties next to tags intact', () => {
    expect(templates.render('{code:{{{url}}}; option:qrcode,5,l}', { url: 'https://example.com' })).toBe(
      '{code:https://example.com; option:qrcode,5,l}',
    );
  });

  it('reports broken templates as TemplateSyntaxError', () => {
    expect(() => templates.render('{{#open}} never closed', {})).toThrow(TemplateSyntaxError);
  });
});

describe('TemplateRenderer.variables', () => {
  it('lists each blank once, with its kind, in first-use order', () => {
    const body = '{{title}} {{#todos}}{{.}}{{/todos}} {{#urgent}}!{{/urgent}} {{{raw}}} {{title}}';

    expect(templates.variables(body)).toEqual([
      { name: 'title', kind: 'text' },
      { name: 'todos', kind: 'list' },
      { name: 'urgent', kind: 'flag' },
      { name: 'raw', kind: 'text' },
    ]);
  });

  it('reports broken templates as TemplateSyntaxError', () => {
    expect(() => templates.variables('{{/never-opened}}')).toThrow(TemplateSyntaxError);
  });
});
