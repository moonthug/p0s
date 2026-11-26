import { Job } from 'sidequest';

/** Does the actual printing for one of our jobs; returns an error message, or null on success. */
export type PrintProcessor = (jobId: string, signal: AbortSignal) => Promise<string | null>;

/**
 * Sidequest job class. Sidequest instantiates it itself, so it can't take constructor
 * dependencies. Instead the owning PrintQueue registers its processor on the class.
 * This only works because the engine runs inline (`fork: false`, `runner: "inline"`),
 * in the same module graph as the rest of the app.
 */
export class PrintJob extends Job {
  static processor: PrintProcessor | null = null;

  async run(jobId: string) {
    if (!PrintJob.processor) {
      throw new Error('PrintJob processor not registered');
    }

    const error = await PrintJob.processor(jobId, this.abortSignal);

    return error ? this.fail(error) : undefined;
  }
}
