import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

const theme = EditorView.theme({
  '&': { fontSize: '0.9375rem', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '0.75rem 0' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--color-secondary)' },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'color-mix(in oklab, var(--color-base-300), transparent 50%)',
  },
});

type ReceiptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called on ⌘/Ctrl+Enter */
  onSubmit: () => void;
};

/** Plain-text editor for ReceiptLine. Monospace matters: columns line up by spaces. */
export function ReceiptEditor({ value, onChange, onSubmit }: ReceiptEditorProps) {
  const extensions = useMemo(
    () => [
      EditorView.lineWrapping,
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onSubmit();

              return true;
            },
          },
        ]),
      ),
    ],
    [onSubmit],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={theme}
      extensions={extensions}
      minHeight="22rem"
      aria-label="ReceiptLine document"
      basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: false, searchKeymap: true }}
    />
  );
}
