import type { hc, InferResponseType } from 'hono/client';

import type { AppType } from './generated/routes.js';

/** The raw Hono RPC client, typed from the API's routes. */
export type P0sRpc = ReturnType<typeof hc<AppType>>;

/** How an image becomes black and white: dithered (photos), thresholded (logos, text, QR codes), or chosen for you. */
export type ImageMode = 'auto' | 'photo' | 'line';

export type ImageUploadOptions = {
  mode?: ImageMode;
  /** Printed width as a percentage of the paper width (10–100). */
  width?: number;
  rotate?: 0 | 90 | 180 | 270;
  /** Print even if the image would use more than about 25 cm of paper. */
  force?: boolean;
};

/** Values to fill a template's blanks with. */
export type TemplateVars = Record<string, unknown>;

export type TemplateInput = { title: string; body: string; sample: TemplateVars };

// Response shapes, read straight from the routes so they can't drift from the API.
export type Job = InferResponseType<P0sRpc['jobs'][':id']['$get'], 200>;
export type StatusResponse = InferResponseType<P0sRpc['status']['$get'], 200>;
export type Template = InferResponseType<P0sRpc['templates']['$get'], 200>[number];
export type TemplateDetail = InferResponseType<P0sRpc['templates'][':name']['$get'], 200>;
export type ImagePreview = InferResponseType<P0sRpc['preview']['image']['$post'], 200>;
