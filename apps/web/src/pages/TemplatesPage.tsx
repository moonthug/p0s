import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

import type { Template } from '@p0s/shared';

import { usePrintTemplate, useTemplates } from '../hooks/queries';
import { useJobProgress } from '../hooks/useJobProgress';

function TemplateRow({ template }: { template: Template }) {
  const print = usePrintTemplate();
  const progress = useJobProgress();
  const [sent, setSent] = useState<boolean>(false);

  return (
    <li className="flex items-center gap-4 border-b border-base-300 px-4 py-3 last:border-b-0">
      <Link href={`/templates/${template.name}`} className="min-w-0 flex-1 rounded-field focus-visible:outline-2">
        <span className="block truncate font-medium">{template.title}</span>
        <span className="block truncate font-mono text-sm text-secondary">{template.name}</span>
      </Link>

      {sent && (
        <span className="hidden text-sm text-secondary sm:inline" aria-live="polite">
          {print.error ? `Couldn't send: ${print.error.message}` : progress.message}
        </span>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={print.isPending}
        onClick={() => {
          setSent(true);
          print.mutate({ name: template.name }, { onSuccess: progress.track });
        }}
      >
        Print example
      </button>

      <Link href={`/templates/${template.name}`} className="btn btn-sm">
        Edit
      </Link>
    </li>
  );
}

export function TemplatesPage() {
  const { data: templates, isPending, error } = useTemplates();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-secondary">
          Reusable layouts with blanks to fill in. Print them from here, or from scripts and automations.
        </p>

        <Link href="/templates/new" className="btn btn-primary">
          <Plus className="size-4" aria-hidden="true" />
          New template
        </Link>
      </div>

      {isPending && <p className="text-secondary">Loading templates…</p>}

      {error && <p className="text-error">Couldn't load templates: {error.message}</p>}

      {templates?.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg font-semibold">No templates yet</p>
          <p className="mt-1 text-secondary">Make one for anything you print often, like a to-do list or a label.</p>
        </div>
      )}

      {templates && templates.length > 0 && (
        <ul className="rounded-box border border-base-300 bg-base-100">
          {templates.map((template) => (
            <TemplateRow key={template.name} template={template} />
          ))}
        </ul>
      )}
    </div>
  );
}
