import type { ImageUploadOptions } from '@moonthug/p0s-client';

import type { TemplateVars } from '@p0s/shared';

/** Identifies an uploaded file in a query key (File objects don't serialise). */
export const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export const queryKeys = {
  status: ['status'] as const,
  jobs: ['jobs'] as const,
  preview: (doc: string) => ['preview', doc] as const,
  imagePreview: (file: File, options: ImageUploadOptions) => ['preview', 'image', fileKey(file), options] as const,
  templates: ['templates'] as const,
  template: (name: string) => ['templates', name] as const,
  templateDraft: (body: string, vars: TemplateVars) => ['preview', 'template', body, vars] as const,
};
