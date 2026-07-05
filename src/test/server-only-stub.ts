// Test-only stub for the `server-only` package.
//
// The real `server-only` module is a build-time guard whose sole purpose is to
// fail the bundle if a server module is pulled into a client bundle. Under
// vitest (node/jsdom) there is no such boundary, so we alias `server-only` to
// this no-op module (see vitest.config.ts) allowing server modules that are
// transitively imported by client component trees to load without error.
export {};
