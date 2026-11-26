import { useEffect, useMemo, useState } from 'react';
import { useDebounceValue } from 'usehooks-ts';
import { Link, useLocation } from 'wouter';

import { type TemplateVariable, type TemplateVars, templateVariables } from '@p0s/shared';

import { Paper } from '../components/Paper';
import { PrintBar } from '../components/PrintBar';
import { ReceiptEditor } from '../components/ReceiptEditor';
import { ScriptSnippet } from '../components/ScriptSnippet';
import { VariableForm } from '../components/VariableForm';
import {
  useDeleteTemplate,
  usePrintTemplate,
  useSaveTemplate,
  useTemplate,
  useTemplateDraftPreview,
} from '../hooks/queries';
import { useJobProgress } from '../hooks/useJobProgress';
import { errorMessage } from '../lib/errors';

const STARTER_BODY = '^^{{heading}}\n-\n{{#items}}\n|[ ] {{.}} |\n{{/items}}';
const STARTER_VARS: TemplateVars = { heading: 'My list', items: ['First thing', 'Second thing'] };

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Variables in the body, or the reason the body can't be read. */
function parseVariables(body: string): { variables: TemplateVariable[]; error: string | null } {
  try {
    return { variables: templateVariables(body), error: null };
  } catch (err) {
    return { variables: [], error: err instanceof Error ? err.message : 'Invalid template' };
  }
}

/** Create (`name` null) or edit a template: body, blanks to fill in, live preview, print and save. */
export function TemplateEditorPage({ name }: { name: string | null }) {
  const isNew = name === null;
  const [, navigate] = useLocation();
  const saved = useTemplate(name);

  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [slugEdited, setSlugEdited] = useState<boolean>(false);
  const [body, setBody] = useState<string>(isNew ? STARTER_BODY : '');
  const [vars, setVars] = useState<TemplateVars>(isNew ? STARTER_VARS : {});
  const [loaded, setLoaded] = useState<boolean>(isNew);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  // Fill the form once the saved template arrives.
  useEffect(() => {
    if (saved.data && !loaded) {
      setTitle(saved.data.title);
      setBody(saved.data.body);
      setVars(saved.data.sample);
      setLoaded(true);
    }
  }, [saved.data, loaded]);

  const [debouncedBody] = useDebounceValue<string>(body, 300);
  const [debouncedVars] = useDebounceValue<TemplateVars>(vars, 300);

  const { variables, error: syntaxError } = useMemo(() => parseVariables(body), [body]);
  const preview = useTemplateDraftPreview(syntaxError ? '' : debouncedBody, debouncedVars);

  const save = useSaveTemplate();
  const print = usePrintTemplate();
  const remove = useDeleteTemplate();
  const progress = useJobProgress();

  const finalName = isNew ? (slugEdited ? slug : slugify(title)) : name;
  const dirty =
    isNew ||
    (saved.data !== undefined &&
      (title !== saved.data.title ||
        body !== saved.data.body ||
        JSON.stringify(vars) !== JSON.stringify(saved.data.sample)));
  const canSave = title.trim().length > 0 && finalName.length > 0 && body.trim().length > 0 && !syntaxError;

  const persist = () => save.mutateAsync({ name: finalName, input: { title, body, sample: vars }, isNew });

  const onSave = async () => {
    const template = await persist();

    if (isNew) {
      navigate(`/templates/${template.name}`, { replace: true });
    }
  };

  // Printing uses the saved template, so save any edits first.
  const onPrint = async () => {
    if (dirty) {
      await onSave();
    }

    print.mutate({ name: finalName, vars }, { onSuccess: progress.track });
  };

  const onDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);

      return;
    }

    remove.mutate(finalName, { onSuccess: () => navigate('/templates', { replace: true }) });
  };

  if (!isNew && saved.error) {
    return (
      <p className="text-error">
        Couldn't load this template: {saved.error.message}.{' '}
        <Link href="/templates" className="link">
          Back to templates
        </Link>
      </p>
    );
  }

  if (!loaded) {
    return <p className="text-secondary">Loading template…</p>;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="flex min-w-0 flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              type="text"
              className="input w-full"
              value={title}
              placeholder="Shopping list"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name in URLs</span>
            <input
              type="text"
              className="input w-full font-mono"
              value={finalName}
              readOnly={!isNew}
              placeholder="shopping-list"
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Layout</span>
          <div className="rounded-box border border-base-300 bg-base-100 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
            <ReceiptEditor value={body} onChange={setBody} onSubmit={onPrint} />
          </div>
          {syntaxError ? (
            <p className="text-sm text-error">{syntaxError}</p>
          ) : (
            <p className="text-sm text-secondary">
              ReceiptLine, with blanks in <code className="font-mono">{'{{double braces}}'}</code>.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Fill in</h2>
          <VariableForm variables={variables} values={vars} onChange={setVars} />
        </div>

        <PrintBar
          onPrint={onPrint}
          disabled={!canSave}
          pending={print.isPending || save.isPending}
          error={print.error ?? save.error}
          message={progress.message}
        >
          <div className="ml-auto flex gap-2">
            {!isNew && (
              <button
                type="button"
                className={`btn btn-sm ${confirmDelete ? 'btn-error' : 'btn-ghost'}`}
                onClick={onDelete}
                onBlur={() => setConfirmDelete(false)}
                disabled={remove.isPending}
              >
                {confirmDelete ? 'Delete for good' : 'Delete'}
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm"
              onClick={onSave}
              disabled={!canSave || !dirty || save.isPending}
            >
              {isNew ? 'Save template' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </PrintBar>

        {!isNew && <ScriptSnippet name={finalName} vars={vars} />}
      </section>

      <section aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start lg:pt-2">
        <Paper
          svg={syntaxError ? undefined : preview.data}
          loading={preview.isFetching}
          error={syntaxError ?? errorMessage(preview.error, 'Preview failed')}
        />
      </section>
    </div>
  );
}
