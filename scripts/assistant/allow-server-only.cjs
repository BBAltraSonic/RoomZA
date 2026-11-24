// The eval runner calls the same server code production uses. Outside Next, `server-only`
// is not resolvable, so point it at Next's own empty build of it (what server bundles get).
const Module = require("node:module");
const path = require("node:path");

const empty = path.join(__dirname, "../../node_modules/next/dist/compiled/server-only/empty.js");
const resolve = Module._resolveFilename;
Module._resolveFilename = function resolveServerOnly(request, ...rest) {
  return request === "server-only" ? empty : resolve.call(this, request, ...rest);
};
