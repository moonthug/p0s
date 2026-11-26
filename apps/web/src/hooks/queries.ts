import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/ApiClient';
import { queryKeys } from '@/api/queryKeys';

export const useStatus = () => useQuery({ queryKey: queryKeys.status, queryFn: () => api.status() });

export const useJobs = () => useQuery({ queryKey: queryKeys.jobs, queryFn: () => api.jobs() });

/** SVG preview for a ReceiptLine document. Keeps the last preview on screen while the next renders. */
export const usePreview = (doc: string) =>
  useQuery({
    queryKey: queryKeys.preview(doc),
    queryFn: ({ signal }) => api.preview({ doc }, signal),
    enabled: doc.trim().length > 0,
    placeholderData: (previous) => previous,
    staleTime: Number.POSITIVE_INFINITY,
  });

// Job updates arrive over SSE, so mutations don't need to invalidate anything.
export const usePrint = () => useMutation({ mutationFn: (doc: string) => api.print({ doc }) });

export const useReprint = () => useMutation({ mutationFn: (id: string) => api.reprint(id) });

export const useCancel = () => useMutation({ mutationFn: (id: string) => api.cancel(id) });
