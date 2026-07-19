import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // `server-only` is a build-time client/server boundary guard with no
            // runtime behavior; alias it to a no-op stub so server modules that
            // are transitively imported by client component trees load under test.
            'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
        },
    },
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
        environment: 'node',
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
})
