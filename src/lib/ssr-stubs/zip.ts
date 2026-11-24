/**
 * Stand-in for `@zip.js/zip.js` while server-rendering client components.
 * The import workspace loads it lazily from a file-picker handler, which never
 * runs on the server; `next.config.ts` aliases it here for the SSR layer only
 * so the Cloudflare Worker does not carry the zip reader.
 */

class UnavailableOnServer {
  constructor() {
    throw new Error("Zip reading is only available in the browser.");
  }
}

export const BlobReader = UnavailableOnServer;
export const BlobWriter = UnavailableOnServer;
export const ZipReader = UnavailableOnServer;
