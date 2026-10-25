import nextWorker from "../worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../worker.js";
import { discoveryAssetResponse } from "../discovery-assets.mjs";
import securityHeaders from "../discovery-headers.mjs";
import { discoveryApiResponse } from "../discovery-api-routing.mjs";

const worker = {
  async fetch(request, env, ctx) {
    return await discoveryAssetResponse(request, env, securityHeaders) ??
      await discoveryApiResponse(request, env, securityHeaders) ?? nextWorker.fetch(request, env, ctx);
  },
};
export default worker;
