import nextWorker from "../worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../worker.js";
import { discoveryAssetResponse } from "../discovery-assets.mjs";
import securityHeaders from "../discovery-headers.mjs";

const worker = {
  async fetch(request, env, ctx) {
    return await discoveryAssetResponse(request, env, securityHeaders) ?? nextWorker.fetch(request, env, ctx);
  },
};
export default worker;
