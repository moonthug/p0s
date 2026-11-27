/** Sent to MCP clients when they connect, so the model knows the printer and the markup before it calls a tool. */
export const INSTRUCTIONS = `p0s prints to an Epson TM-T20II thermal receipt printer: 80 mm paper, 48 characters per line, black only.
Every printout is cut at the end. Printing is queued: a print tool reports whether the job printed, or why it's
waiting (e.g. out of paper). Use preview_receipt to check a layout before using paper.

## ReceiptLine (the markup print_receipt takes)

- Lines are centred by default. Wrap a line in | to align it: "|Left  |", "|  Right|".
- Columns: "|Coffee | £2.80|" (the side a cell's text touches is where it leans).
- Styles toggle on and off, ending at the end of the line: "Bold", _underline_, \`inverted\`.
- Bigger text: ^ wide, ^^ tall, ^^^ both, more carets for bigger (up to 7).
- A line of just - is a rule across the paper; a line of just = cuts the paper.
- A line in { } sets options for the lines after it:
  {width:*,6,8} column widths (* takes what's left) · {border:line} boxed tables · {align:left}
- QR code: {code:https://example.com; option:qrcode,6,m} (dot size 3–8, error correction l/m/q/h).
- Barcode: {code:012345678905; option:upc,2,72,hri} (upc, ean, code39, itf, codabar, code93, code128).
- Backslash prints a special character as-is: \\| \\{ \\} \\^ \\" \\_ \\\` \\- \\= \\~
- Emoji don't print; the printer has no glyphs for them.

## Templates (Mustache over ReceiptLine)

- {{name}} fills a blank; values print exactly as typed, so markup characters in a value can't break the layout.
- {{{name}}} inserts a value as ReceiptLine (its markup works). Use it inside { } options, e.g. {code:{{{url}}}}.
- {{#items}}…{{/items}} repeats for each item ({{.}} is the item, or use the item's fields);
  it shows once for true, and not at all for false or an empty list. {{^items}}…{{/items}} is the opposite.
- {{! a comment }} isn't printed.

Example: a shopping list template body
  ^^"Shopping
  {{#items}}
  |[ ] {{.}} |
  {{/items}}
printed with vars {"items": ["Milk", "Eggs"]}.`;
