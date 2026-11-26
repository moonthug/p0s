import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { type Template, type TemplateDetail, TemplateName } from '@p0s/shared';

import type { AppEnv } from '../container';
import type { TemplateRenderer } from '../templates/TemplateRenderer';

const Vars = z.record(z.string(), z.unknown());

const TemplateWrite = z.object({
  title: z.string().trim().min(1),
  body: z.string().min(1),
  sample: Vars.default({}),
});

const TemplateCreate = TemplateWrite.extend({ name: TemplateName });

/** Variables to fill in; when omitted, the template's saved sample values are used. */
const FillBody = z.object({ vars: Vars.optional() });

const DraftPreview = z.object({ body: z.string(), vars: Vars.default({}) });

const SVG_HEADERS = { 'content-type': 'image/svg+xml' } as const;

const detail = (template: Template, renderer: TemplateRenderer): TemplateDetail => ({
  ...template,
  variables: renderer.variables(template.body),
});

/** /templates — saved ReceiptLine templates with Mustache variables, for the UI and automations. */
export const templateRoutes = new Hono<AppEnv>()
  .get('/', (c) => c.json(c.var.di.get('templateRepository').list()))

  .post('/', zValidator('json', TemplateCreate), (c) => {
    const { name, ...input } = c.req.valid('json');
    const renderer = c.var.di.get('templateRenderer');

    renderer.variables(input.body); // rejects invalid Mustache before saving

    const template = c.var.di.get('templateRepository').create(name, input);

    return template
      ? c.json(detail(template, renderer), 201)
      : c.json({ error: `A template called "${name}" already exists` }, 409);
  })

  // Live preview for the editor, before anything is saved.
  .post('/preview', zValidator('json', DraftPreview), (c) => {
    const { body, vars } = c.req.valid('json');
    const doc = c.var.di.get('templateRenderer').render(body, vars);

    return c.body(c.var.di.get('renderer').toSvg(doc), 200, SVG_HEADERS);
  })

  .get('/:name', (c) => {
    const template = c.var.di.get('templateRepository').get(c.req.param('name'));

    return template ? c.json(detail(template, c.var.di.get('templateRenderer'))) : c.json({ error: 'not found' }, 404);
  })

  .put('/:name', zValidator('json', TemplateWrite), (c) => {
    const input = c.req.valid('json');
    const renderer = c.var.di.get('templateRenderer');

    renderer.variables(input.body);

    const template = c.var.di.get('templateRepository').update(c.req.param('name'), input);

    return template ? c.json(detail(template, renderer)) : c.json({ error: 'not found' }, 404);
  })

  .delete('/:name', (c) => {
    const deleted = c.var.di.get('templateRepository').delete(c.req.param('name'));

    return deleted ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
  })

  .post('/:name/preview', zValidator('json', FillBody), (c) => {
    const template = c.var.di.get('templateRepository').get(c.req.param('name'));

    if (!template) {
      return c.json({ error: 'not found' }, 404);
    }

    const doc = c.var.di.get('templateRenderer').render(template.body, c.req.valid('json').vars ?? template.sample);

    return c.body(c.var.di.get('renderer').toSvg(doc), 200, SVG_HEADERS);
  })

  .post('/:name/print', zValidator('json', FillBody), async (c) => {
    const template = c.var.di.get('templateRepository').get(c.req.param('name'));

    if (!template) {
      return c.json({ error: 'not found' }, 404);
    }

    const vars = c.req.valid('json').vars ?? template.sample;
    const doc = c.var.di.get('templateRenderer').render(template.body, vars);
    const payload = c.var.di.get('renderer').toEscPos(doc);

    const job = await c.var.di
      .get('printQueue')
      .enqueue({ kind: 'template', source: doc, template: template.name, vars, payload });

    return c.json(job, 202);
  });
