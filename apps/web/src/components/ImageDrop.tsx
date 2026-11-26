import { ImageUp } from 'lucide-react';
import { type DragEvent, useEffect, useState } from 'react';

type ImageDropProps = { file: File | null; onFile: (file: File) => void };

/** Choose, drop or paste an image. Pasting works anywhere on the page while this is mounted. */
export function ImageDrop({ file, onFile }: ImageDropProps) {
  const [dragging, setDragging] = useState<boolean>(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const image = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));

      if (image) {
        e.preventDefault();
        onFile(image);
      }
    };

    window.addEventListener('paste', onPaste);

    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const image = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));

    if (image) {
      onFile(image);
    }
  };

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-primary/25 ${
        dragging ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100 hover:border-secondary'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <ImageUp className="size-6 text-secondary" aria-hidden="true" />

      <span className="font-medium">{file ? file.name : 'Choose an image'}</span>
      <span className="text-sm text-secondary">
        {file ? 'Choose, drop or paste another to replace it' : 'or drop one here, or paste from the clipboard'}
      </span>

      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0];

          if (chosen) {
            onFile(chosen);
          }
        }}
      />
    </label>
  );
}
