import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import type { TemplateVars } from '@p0s/shared';

import { api } from '../api/api';

type ScriptSnippetProps = { name: string; vars: TemplateVars };

/** A copy-paste curl command that prints this template, for Home Assistant, cron jobs and the like. */
export function ScriptSnippet({ name, vars }: ScriptSnippetProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const body = JSON.stringify({ vars }).replaceAll("'", "'\\''");
  const command = [
    `curl -X POST ${api.url(`/templates/${name}/print`)} \\`,
    `  -H 'content-type: application/json' \\`,
    `  -d '${body}'`,
  ].join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details className="rounded-box border border-base-300 bg-base-100">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Print it from a script</summary>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-sm text-secondary">
          Send the values you want to fill in. Leave out <code className="font-mono">vars</code> to use the ones saved
          with the template.
        </p>

        <pre className="overflow-x-auto rounded-field bg-neutral p-3 font-mono text-sm text-neutral-content">
          {command}
        </pre>

        <button type="button" className="btn btn-sm w-fit" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy command'}
        </button>
      </div>
    </details>
  );
}
