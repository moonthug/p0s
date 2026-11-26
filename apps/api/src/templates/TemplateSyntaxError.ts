/** The template body isn't valid Mustache (e.g. an unclosed `{{#section}}`). */
export class TemplateSyntaxError extends Error {
  constructor(cause: unknown) {
    super(`Template error: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}
