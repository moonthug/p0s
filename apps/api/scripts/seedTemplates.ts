/**
 * One-shot: adds a starter set of templates. Existing templates (by name) are left untouched,
 * so it's safe to run again. Run with `pnpm --filter @p0s/api db:seed`.
 */
import { loadConfig } from '../src/config';
import { Database } from '../src/db/Database';
import { TemplateRenderer } from '../src/templates/TemplateRenderer';
import { TemplateRepository, type TemplateWrite } from '../src/templates/TemplateRepository';

const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const SEEDS: Record<string, TemplateWrite> = {
  'daily-briefing': {
    title: 'Daily briefing',
    body: [
      '^^^{{day}}',
      '{{date}}',
      '-',
      '|"Weather | {{weather}}|',
      '-',
      '"Today',
      '{{#events}}',
      '| {{.}} |',
      '{{/events}}',
      '{{^events}}',
      'Nothing in the calendar.',
      '{{/events}}',
      '-',
      '"To do',
      '{{#todos}}',
      '|[ ] {{.}} |',
      '{{/todos}}',
    ].join('\n'),
    sample: {
      day: today.split(' ')[0],
      date: today.split(' ').slice(1).join(' '),
      weather: '12°C, light rain',
      events: ['09:30 Stand-up', '13:00 Dentist'],
      todos: ['Bins out', 'Order printer paper'],
    },
  },

  'daily-todo': {
    title: 'Daily to-do',
    body: ['^^{{title}}', '{{#todos}}', '| [ ] {{.}} |', '{{/todos}}'].join('\n'),
    sample: { title: 'Today', todos: ['Bins out', 'Fish | chips'] },
  },

  'shopping-list': {
    title: 'Shopping list',
    body: ['^^Shopping', '{{shop}}', '-', '{{#items}}', '|[ ] {{.}} |', '{{/items}}'].join('\n'),
    sample: { shop: 'Saturday big shop', items: ['Milk', 'Eggs', 'Coffee beans', 'Bread'] },
  },

  note: {
    title: 'Note',
    body: ['^^^{{heading}}', '-', '{{message}}', '{{#from}}', '', '| — {{from}}|', '{{/from}}'].join('\n'),
    sample: { heading: 'Back soon', message: 'Gone to the shop. Kettle is on.', from: 'Alex' },
  },

  'wifi-guest': {
    title: 'Guest Wi-Fi',
    // Inside a {code:…} property, `;` must be escaped as `\;` for ReceiptLine. Values are inserted raw ({{{…}}})
    // because the text escaping doesn't apply inside a property.
    body: [
      '^^Guest Wi-Fi',
      'Scan to join',
      '{code:WIFI:T:WPA\\;S:{{{network}}}\\;P:{{{password}}}\\;\\;; option:qrcode,6,m}',
      '-',
      '|Network | "{{network}}|',
      '|Password | "{{password}}|',
    ].join('\n'),
    sample: { network: 'Home-Guest', password: 'correct-horse-battery' },
  },

  'fridge-label': {
    title: 'Fridge label',
    body: [
      '^^^{{item}}',
      '-',
      '|Made | {{made}}|',
      '|Use by | "{{useBy}}|',
      '{{#notes}}',
      '-',
      '{{notes}}',
      '{{/notes}}',
    ].join('\n'),
    sample: { item: 'Chilli', made: 'Thu 26 Nov', useBy: 'Sun 29 Nov', notes: 'Freezes well' },
  },
};

const db = new Database(loadConfig().DB_PATH);
const repository = new TemplateRepository(db);
const renderer = new TemplateRenderer();

for (const [name, seed] of Object.entries(SEEDS)) {
  renderer.render(seed.body, seed.sample); // fail loudly on a broken seed rather than storing it

  const created = repository.create(name, seed);

  console.log(created ? `added    ${name}` : `skipped  ${name} (already exists)`);
}

db.close();
