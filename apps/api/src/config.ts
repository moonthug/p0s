import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().default(3000),
  PRINTER: z.enum(['usb', 'fake']).default('usb'),
  FAKE_FAULT: z.enum(['paper-out', 'cover-open', 'offline', 'disconnected']).optional(),
  USB_VENDOR_ID: z.coerce.number().default(0x04b8),
  USB_PRODUCT_ID: z.coerce.number().default(0x0e15),
  DB_PATH: z.string().default('./data/p0s.db'),
  /** Sidequest dashboard port; 0 disables it */
  QUEUE_DASHBOARD_PORT: z.coerce.number().default(8678),
  /** Seconds a job may wait in the queue before it expires */
  JOB_MAX_WAIT: z.coerce.number().default(600),
  ENCODING: z.string().default('cp858'),
  /** Web origins allowed to call the API from a browser: comma-separated, `*` for any. Empty: none. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((list) =>
      list
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Config = z.infer<typeof Env>;
export const loadConfig = (env = process.env): Config => Env.parse(env);
