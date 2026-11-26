import type { ImageUploadOptions, TemplateInput } from '@moonthug/p0s-client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TemplateVars } from '@p0s/shared';

import { api } from '../api/api';
import { queryKeys } from '../api/queryKeys';

/** Previews keep the last result on screen while the next one renders, and never go stale on their own. */
const previewOptions = { placeholderData: keepPreviousData, staleTime: Number.POSITIVE_INFINITY } as const;

export const useStatus = () => useQuery({ queryKey: queryKeys.status, queryFn: () => api.status() });

export const useJobs = () => useQuery({ queryKey: queryKeys.jobs, queryFn: () => api.jobs() });

export const usePreview = (doc: string) =>
  useQuery({
    queryKey: queryKeys.preview(doc),
    queryFn: ({ signal }) => api.preview(doc, signal),
    enabled: doc.trim().length > 0,
    ...previewOptions,
  });

export const useImagePreview = (file: File | null, options: ImageUploadOptions) =>
  useQuery({
    queryKey: file ? queryKeys.imagePreview(file, options) : ['preview', 'image', 'none'],
    queryFn: ({ signal }) => api.previewImage(file as File, options, signal),
    enabled: file !== null,
    ...previewOptions,
  });

export const useTemplates = () => useQuery({ queryKey: queryKeys.templates, queryFn: () => api.templates() });

export const useTemplate = (name: string | null) =>
  useQuery({
    queryKey: queryKeys.template(name ?? ''),
    queryFn: () => api.template(name as string),
    enabled: name !== null,
  });

export const useTemplateDraftPreview = (body: string, vars: TemplateVars) =>
  useQuery({
    queryKey: queryKeys.templateDraft(body, vars),
    queryFn: ({ signal }) => api.previewTemplateDraft(body, vars, signal),
    enabled: body.trim().length > 0,
    retry: false,
    ...previewOptions,
  });

// Job updates arrive over SSE, so print mutations don't need to invalidate anything.
export const usePrint = () => useMutation({ mutationFn: (doc: string) => api.print(doc) });

export const usePrintImage = () =>
  useMutation({
    mutationFn: ({ file, options }: { file: File; options: ImageUploadOptions }) => api.printImage(file, options),
  });

export const useReprint = () => useMutation({ mutationFn: (id: string) => api.reprint(id) });

export const useCancel = () => useMutation({ mutationFn: (id: string) => api.cancel(id) });

export const usePrintTemplate = () =>
  useMutation({ mutationFn: ({ name, vars }: { name: string; vars?: TemplateVars }) => api.printTemplate(name, vars) });

/** Create or update; refreshes the template list and the saved copy. */
export const useSaveTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, input, isNew }: { name: string; input: TemplateInput; isNew: boolean }) =>
      isNew ? api.createTemplate(name, input) : api.updateTemplate(name, input),
    onSuccess: (template) => {
      queryClient.setQueryData(queryKeys.template(template.name), template);
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates, exact: true });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.deleteTemplate(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates, exact: true }),
  });
};
