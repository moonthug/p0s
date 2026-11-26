/** A failed request: the HTTP status and the API's own `{ error }` message. */
export class P0sError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'P0sError';
  }
}
