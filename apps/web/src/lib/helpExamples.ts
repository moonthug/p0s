import type { TemplateVars } from '@p0s/shared';

export type ReceiptExample = { id: string; title: string; description: string; doc: string };

export type TemplateExample = {
  id: string;
  title: string;
  description: string;
  body: string;
  vars: TemplateVars;
};

/** Every example here was checked against the real renderer; each one previews live on the help page. */
export const RECEIPT_EXAMPLES: ReceiptExample[] = [
  {
    id: 'styles',
    title: 'Bold, underline and inverted text',
    description:
      'A marker turns a style on and the next one turns it off: " for bold, _ for underline, ` for white-on-black. Styles end at the end of the line.',
    doc: 'Normal text\n"Bold" text, _underlined_ text\n`Inverted` text',
  },
  {
    id: 'sizes',
    title: 'Bigger text',
    description:
      'Carets make text larger: ^ is twice as wide, ^^ twice as tall, ^^^ both. Add more for bigger still, up to seven.',
    doc: '^Wide\n^^Tall\n^^^Big\n^^^^^Huge',
  },
  {
    id: 'alignment',
    title: 'Left, right and centre',
    description:
      'Lines are centred unless you say otherwise. Wrap a line in | and the text leans toward the side it touches.',
    doc: '|Left  |\n|  Right|\n| Centre |',
  },
  {
    id: 'columns',
    title: 'Columns',
    description: 'Split a line into columns with |. A receipt line is 48 characters wide.',
    doc: '|Coffee | £2.80|\n|Croissant | £2.10|\n-\n|"Total | "£4.90|',
  },
  {
    id: 'widths',
    title: 'Fixed column widths',
    description:
      'A line in { } sets options for the lines after it. width gives each column a width in characters; * takes what is left.',
    doc: '{width:*,6,8}\n|Item |Qty |  Price|\n|Coffee | 2|  £5.60|\n|Croissant | 1|  £2.10|',
  },
  {
    id: 'borders',
    title: 'Boxed tables',
    description: 'border:line draws lines around and between the columns.',
    doc: '{border:line; width:*,10}\n|Name | Score|\n|Alex | 42|\n|Sam | 37|',
  },
  {
    id: 'rules',
    title: 'Lines and cuts',
    description:
      'A line of just - draws a rule across the paper. A line of just = cuts it. Every receipt is cut at the end anyway.',
    doc: 'Above the line\n-\nBelow the line\n=\nOn a new piece of paper',
  },
  {
    id: 'qr',
    title: 'QR codes',
    description: 'option:qrcode,6,m sets the size of each dot (3 to 8) and how much damage it survives (l, m, q or h).',
    doc: '{code:https://example.com; option:qrcode,6,m}\nScan me',
  },
  {
    id: 'barcodes',
    title: 'Barcodes',
    description:
      'Barcode types: upc, ean, code39, itf, codabar, code93 and code128. Then bar width (2 to 4), height (24 to 240) and hri to print the number underneath.',
    doc: '{code:012345678905; option:upc,2,72,hri}',
  },
  {
    id: 'escapes',
    title: 'Printing the special characters',
    description: 'Put a backslash before a character to print it as-is instead of using it as markup.',
    doc: 'Pipes \\| braces \\{ \\} and a caret \\^ print as-is',
  },
];

export const TEMPLATE_EXAMPLES: TemplateExample[] = [
  {
    id: 'blanks',
    title: 'Blanks',
    description: 'Put a name in double braces. Each one becomes a box to fill in on the template page.',
    body: '^^{{title}}\nHello, {{name}}!',
    vars: { title: 'Welcome', name: 'Sam' },
  },
  {
    id: 'lists',
    title: 'Lists',
    description:
      'A section repeats once for each item. {{.}} is the item itself. On the template page, a list is one item per line.',
    body: '"Shopping\n{{#items}}\n|[ ] {{.}} |\n{{/items}}',
    vars: { items: ['Milk', 'Eggs', 'Bread'] },
  },
  {
    id: 'rows',
    title: 'Lists of rows',
    description:
      'Items can have their own fields, like a line on a bill. The template page only fills in simple lists, so send these from a script.',
    body: '{{#lines}}\n|{{item}} | {{price}}|\n{{/lines}}',
    vars: {
      lines: [
        { item: 'Coffee', price: '£2.80' },
        { item: 'Croissant', price: '£2.10' },
      ],
    },
  },
  {
    id: 'conditions',
    title: 'Showing and hiding',
    description:
      'A section shows only when its value is switched on or has items. {{^…}} is the opposite: it shows only when the value is off or empty.',
    body: '{{#urgent}}\n^^"Urgent\n{{/urgent}}\n{{^todos}}\nNothing to do today.\n{{/todos}}',
    vars: { urgent: true, todos: [] },
  },
  {
    id: 'safe',
    title: 'Values print exactly as typed',
    description:
      'Characters like | in a value are printed, not treated as markup, so a value can never break the layout. "Fish | chips" stays in one column.',
    body: '|{{dish}} | {{price}}|',
    vars: { dish: 'Fish | chips', price: '£9.00' },
  },
  {
    id: 'raw',
    title: 'Values with markup',
    description:
      'Triple braces insert a value as ReceiptLine, so its markup works. Use them only for values you control.',
    body: '{{{note}}}',
    vars: { note: '"Bold" and _underlined_' },
  },
  {
    id: 'qr-values',
    title: 'A value in a QR code',
    description:
      'Inside a { } option, use triple braces. A ; or } in the value would end the option early, so keep those out.',
    body: '{code:{{{url}}}; option:qrcode,5,l}\n{{url}}',
    vars: { url: 'https://example.com' },
  },
  {
    id: 'comments',
    title: 'Notes to yourself',
    description: 'Anything in {{! }} is left out of the printout.',
    body: '{{! Printed every morning by Home Assistant }}\nGood morning!',
    vars: {},
  },
];
