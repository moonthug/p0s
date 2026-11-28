import { PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

import type { TemplateVars } from '@p0s/shared';

import { api } from '../api/api';
import { Paper } from '../components/Paper';
import { usePreview, useTemplateDraftPreview } from '../hooks/queries';
import { errorMessage } from '../lib/errors';
import { RECEIPT_EXAMPLES, type ReceiptExample, TEMPLATE_EXAMPLES, type TemplateExample } from '../lib/helpExamples';
import { MCP_PROMPTS, MCP_TOOLS, mcpSetup } from '../lib/mcpHelp';

const SECTIONS = [
  { id: 'receipts', label: 'Writing receipts' },
  { id: 'templates', label: 'Templates' },
  { id: 'scripts', label: 'Printing from scripts' },
  { id: 'assistants', label: 'AI assistants (MCP)' },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-field border border-base-300 bg-base-100 p-4 font-mono text-sm leading-relaxed">
      {children}
    </pre>
  );
}

/** One example: what it is, the source, and how it prints. */
function ExampleRow({
  id,
  title,
  description,
  source,
  preview,
}: {
  id: string;
  title: string;
  description: string;
  source: ReactNode;
  preview: ReactNode;
}) {
  return (
    <article
      id={id}
      className="grid scroll-mt-6 gap-6 border-t border-base-300 py-8 md:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-prose text-secondary">{description}</p>
        {source}
      </div>

      <div className="md:pt-9">{preview}</div>
    </article>
  );
}

function ReceiptExampleRow({ example }: { example: ReceiptExample }) {
  const preview = usePreview(example.doc);
  const [, navigate] = useLocation();

  // Compose keeps its draft in localStorage (as JSON, via usehooks-ts), so write the example there and go.
  const openInCompose = () => {
    localStorage.setItem('p0s:draft', JSON.stringify(example.doc));
    navigate('/');
  };

  return (
    <ExampleRow
      id={example.id}
      title={example.title}
      description={example.description}
      source={
        <>
          <Code>{example.doc}</Code>
          <button type="button" className="btn btn-sm w-fit" onClick={openInCompose}>
            <PenLine className="size-4" aria-hidden="true" />
            Open in Compose
          </button>
        </>
      }
      preview={
        <Paper
          svg={preview.data}
          loading={preview.isFetching}
          error={errorMessage(preview.error, 'Preview failed')}
          slot={false}
        />
      }
    />
  );
}

function TemplateExampleRow({ example }: { example: TemplateExample }) {
  const preview = useTemplateDraftPreview(example.body, example.vars);
  const hasValues = Object.keys(example.vars).length > 0;

  return (
    <ExampleRow
      id={example.id}
      title={example.title}
      description={example.description}
      source={
        <>
          <Code>{example.body}</Code>
          {hasValues && (
            <>
              <span className="text-sm font-medium">Filled in with</span>
              <Code>{JSON.stringify(example.vars, null, 2)}</Code>
            </>
          )}
        </>
      }
      preview={
        <Paper
          svg={preview.data}
          loading={preview.isFetching}
          error={errorMessage(preview.error, 'Preview failed')}
          slot={false}
        />
      }
    />
  );
}

function scriptExamples(): { title: string; command: string }[] {
  const vars: TemplateVars = { items: ['Milk', 'Eggs'] };

  return [
    {
      title: 'Print a receipt',
      command: `curl -X POST ${api.url('/print')} \\\n  -H 'content-type: application/json' \\\n  -d '{"doc": "^^Hello\\nFrom a script"}'`,
    },
    {
      title: 'Print a template, filled in',
      command: `curl -X POST ${api.url('/templates/shopping-list/print')} \\\n  -H 'content-type: application/json' \\\n  -d '${JSON.stringify({ vars })}'`,
    },
    {
      title: 'Print an image',
      command: `curl -X POST ${api.url('/print/image')} \\\n  -F image=@photo.jpg -F mode=auto -F width=100`,
    },
  ];
}

export function HelpPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm lg:flex-col">
          {SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="link link-hover text-secondary hover:text-base-content">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-16">
        <section id="receipts" className="scroll-mt-6">
          <h2 className="text-2xl font-bold tracking-tight">Writing receipts</h2>
          <p className="mt-3 max-w-prose text-secondary">
            Receipts are written in ReceiptLine: plain text, with a few characters that change how it prints. Every
            example below is printed exactly as shown on the right. Open one in{' '}
            <Link href="/" className="link">
              Compose
            </Link>{' '}
            to change it and print it. The{' '}
            <a
              className="link"
              href="https://github.com/receiptline/receiptline#grammar"
              target="_blank"
              rel="noreferrer"
            >
              full ReceiptLine reference
            </a>{' '}
            covers everything else.
          </p>

          <div className="mt-6">
            {RECEIPT_EXAMPLES.map((example) => (
              <ReceiptExampleRow key={example.id} example={example} />
            ))}
          </div>
        </section>

        <section id="templates" className="scroll-mt-6">
          <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
          <p className="mt-3 max-w-prose text-secondary">
            A template is a receipt with blanks, written in ReceiptLine with{' '}
            <a className="link" href="https://mustache.github.io/mustache.5.html" target="_blank" rel="noreferrer">
              Mustache
            </a>{' '}
            tags in double braces. Fill the blanks in on the{' '}
            <Link href="/templates" className="link">
              Templates
            </Link>{' '}
            page, or send the values from a script.
          </p>

          <div className="mt-6">
            {TEMPLATE_EXAMPLES.map((example) => (
              <TemplateExampleRow key={example.id} example={example} />
            ))}
          </div>
        </section>

        <section id="scripts" className="scroll-mt-6">
          <h2 className="text-2xl font-bold tracking-tight">Printing from scripts</h2>
          <p className="mt-3 max-w-prose text-secondary">
            Anything you can do here, a script can do too: Home Assistant, a cron job, a shortcut on your phone. Each
            template page has a ready-made command, and the{' '}
            <Link href="/docs" className="link">
              API page
            </Link>{' '}
            lists every request you can make.
          </p>

          <div className="mt-6 flex flex-col gap-6">
            {scriptExamples().map(({ title, command }) => (
              <div key={title} className="flex flex-col gap-2">
                <h3 className="font-semibold">{title}</h3>
                <Code>{command}</Code>
              </div>
            ))}
          </div>
        </section>

        <section id="assistants" className="scroll-mt-6">
          <h2 className="text-2xl font-bold tracking-tight">AI assistants (MCP)</h2>
          <p className="mt-3 max-w-prose text-secondary">
            p0s is also an MCP server, so an AI assistant like Claude can print for you. Ask in your own words and it
            writes the receipt, checks the preview, and tells you once it has printed, or what the printer is waiting
            for. It already knows ReceiptLine and the template syntax.
          </p>

          <div className="mt-6 flex flex-col gap-6">
            {mcpSetup().map(({ title, description, code }) => (
              <div key={title} className="flex flex-col gap-2">
                <h3 className="font-semibold">{title}</h3>
                <p className="max-w-prose text-sm text-secondary">{description}</p>
                <Code>{code}</Code>
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-prose text-sm text-secondary">
            Claude on the web and in the phone app can’t use it: they connect from the internet, and p0s is only on your
            home network. Anyone on the network can print through it, just as they can with this site.
          </p>

          <h3 className="mt-8 font-semibold">Things to ask</h3>
          <ul className="mt-2 flex max-w-prose list-disc flex-col gap-1 pl-5 text-secondary">
            {MCP_PROMPTS.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>

          <h3 className="mt-8 font-semibold">What it can do</h3>
          <table className="table mt-2 max-w-prose">
            <tbody>
              {MCP_TOOLS.map(({ name, does }) => (
                <tr key={name}>
                  <td className="font-mono text-sm whitespace-nowrap">{name}</td>
                  <td>{does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
