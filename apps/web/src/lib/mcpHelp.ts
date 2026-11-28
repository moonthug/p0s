import { api } from '../api/api';

/** The tools the API's MCP server offers (apps/api/src/mcp/mcpServer.ts), as the help page describes them. */
export const MCP_TOOLS: { name: string; does: string }[] = [
  { name: 'printer_status', does: 'Whether the printer is ready, and what’s queued' },
  { name: 'print_receipt', does: 'Print a ReceiptLine document' },
  { name: 'print_text', does: 'Print plain text exactly as written' },
  { name: 'print_image', does: 'Print an image from a URL' },
  { name: 'preview_receipt', does: 'Show what a receipt will look like, without printing' },
  { name: 'list_templates', does: 'The saved templates and their blanks' },
  { name: 'get_template', does: 'A template’s body and example values' },
  { name: 'preview_template', does: 'Show a filled-in template, without printing' },
  { name: 'print_template', does: 'Print a template, filled in' },
  { name: 'save_template', does: 'Create a template, or replace one with the same name' },
  { name: 'list_jobs', does: 'Recent print jobs and their status' },
  { name: 'reprint_job', does: 'Print an earlier job again' },
  { name: 'cancel_job', does: 'Cancel a job that hasn’t printed yet' },
];

export const MCP_PROMPTS = [
  'Print a shopping list: milk, eggs, bread',
  'Make a template for a weekly chore rota, preview it, then print it with this week’s names',
  'Is the printer out of paper?',
  'Reprint the last thing I printed',
];

/**
 * The MCP endpoint to give an assistant. Assistants run on Node, which doesn't trust the HTTPS certificate p0s makes
 * for itself, so on HTTPS this points at the plain HTTP port instead (8080 in docker-compose.yml).
 */
export function mcpUrl(): string {
  const { protocol, hostname } = window.location;

  return protocol === 'https:' ? `http://${hostname}:8080/api/mcp` : api.url('/mcp');
}

export function mcpSetup(): { title: string; description: string; code: string }[] {
  const url = mcpUrl();

  return [
    {
      title: 'Claude Code',
      description: 'Run this once in a terminal. Then type /mcp in Claude Code to check it’s connected.',
      code: `claude mcp add --transport http --scope user p0s ${url}`,
    },
    {
      title: 'Claude Desktop',
      description:
        'Add this to claude_desktop_config.json (Settings → Developer → Edit config), then restart Claude Desktop.',
      code: JSON.stringify(
        { mcpServers: { p0s: { command: 'npx', args: ['-y', 'mcp-remote', url, '--allow-http'] } } },
        null,
        2,
      ),
    },
    {
      title: 'Any other MCP client',
      description: 'Use the Streamable HTTP transport with this URL.',
      code: url,
    },
  ];
}
