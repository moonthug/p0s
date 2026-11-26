import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ValidationTargets } from 'hono';
import { resolver, validator } from 'hono-openapi';
import type { z } from 'zod';

import { ApiErrorBody } from '@p0s/shared';

/** OpenAPI response helpers, so each route's `describeRoute` stays short. */

export const jsonResponse = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema: resolver(schema) } },
});

export const svgResponse = (description: string) => ({
  description,
  content: { 'image/svg+xml': { schema: { type: 'string' as const } } },
});

export const sseResponse = (description: string) => ({
  description,
  content: { 'text/event-stream': { schema: { type: 'string' as const } } },
});

export const errorResponse = (description: string) => jsonResponse(ApiErrorBody, description);

/**
 * hono-openapi's validator (so the schema is documented), answering a bad request with the API's usual
 * `{ error }` shape instead of the raw issue list, e.g. `doc: Too small: expected string to have >=1 characters`.
 */
export const validate = <Schema extends StandardSchemaV1, Target extends keyof ValidationTargets>(
  target: Target,
  schema: Schema,
) =>
  validator(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error
        .map(({ path, message }) => (path?.length ? `${path.map(String).join('.')}: ${message}` : message))
        .join('; ');

      return c.json({ error: message }, 400);
    }
  });

/** How validation failures are documented: the same `Error` shape every other failure uses. */
export const validationErrorResponse = {
  description: 'Invalid request',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};
