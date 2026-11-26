import type { TemplateVariable, TemplateVars } from '@p0s/shared';

type VariableFormProps = {
  variables: TemplateVariable[];
  values: TemplateVars;
  onChange: (values: TemplateVars) => void;
};

/** `todaysDate` → "Todays date" */
function labelFor(name: string): string {
  const words = name
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A form field for each blank in a template: text, a list (one item per line) or an on/off switch. */
export function VariableForm({ variables, values, onChange }: VariableFormProps) {
  const set = (name: string, value: unknown) => onChange({ ...values, [name]: value });

  if (variables.length === 0) {
    return (
      <p className="text-sm text-secondary">
        This template has no blanks. Add one with <code className="font-mono">{'{{name}}'}</code>, or a list with{' '}
        <code className="font-mono">{'{{#items}}{{.}}{{/items}}'}</code>.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {variables.map(({ name, kind }) => {
        const label = labelFor(name);

        if (kind === 'flag') {
          return (
            <label key={name} className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={Boolean(values[name])}
                onChange={(e) => set(name, e.target.checked)}
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          );
        }

        if (kind === 'list') {
          const items = Array.isArray(values[name]) ? (values[name] as unknown[]).map(String) : [];

          return (
            <label key={name} className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">
                {label} <span className="font-normal text-secondary">(one per line)</span>
              </span>
              <textarea
                className="textarea min-h-28 w-full"
                value={items.join('\n')}
                onChange={(e) => set(name, e.target.value.split('\n'))}
              />
            </label>
          );
        }

        return (
          <label key={name} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{label}</span>
            <input
              type="text"
              className="input w-full"
              value={values[name] === undefined ? '' : String(values[name])}
              onChange={(e) => set(name, e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}
