export const queryKeys = {
  status: ['status'] as const,
  jobs: ['jobs'] as const,
  preview: (doc: string) => ['preview', doc] as const,
};
