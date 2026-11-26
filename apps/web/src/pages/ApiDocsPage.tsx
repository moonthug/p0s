import { ExternalLink } from 'lucide-react';

import { api } from '../api/api';

/** The API's own Swagger UI (generated from its routes), shown inside the app. */
export function ApiDocsPage() {
  const docsUrl = api.url('/docs');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-secondary">
          Everything the web app does goes through this API, so scripts and automations can do it too. Try any request
          with <span className="font-medium text-base-content">Try it out</span>.
        </p>

        <a href={docsUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
          <ExternalLink className="size-4" aria-hidden="true" />
          Open in a new tab
        </a>
      </div>

      <iframe
        src={docsUrl}
        title="p0s API reference"
        className="h-[calc(100vh-13rem)] min-h-[32rem] w-full rounded-box border border-base-300 bg-white"
      />
    </div>
  );
}
