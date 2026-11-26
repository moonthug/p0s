/** The processed image would use more paper than the guard allows. */
export class ImageTooLongError extends Error {
  constructor(readonly lengthCm: number) {
    super(`This image would use about ${lengthCm.toFixed(0)} cm of paper. Send it with force to print it anyway.`);
  }
}
