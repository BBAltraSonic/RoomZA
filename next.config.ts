import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const isProduction = process.env.NODE_ENV === "production";
let configuredLoopbackOrigin = "";
if (!isProduction && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) configuredLoopbackOrigin = ` ${url.origin}`;
  } catch { /* Invalid configuration is reported by the environment validator. */ }
}
const localSupabaseHttpSources = isProduction ? "" : ` http://localhost:54321 http://127.0.0.1:54321 http://*:54321${configuredLoopbackOrigin}`;
const localSupabaseWebSocketSources = isProduction ? "" : ` ws://localhost:54321 ws://127.0.0.1:54321 ws://*:54321${configuredLoopbackOrigin.replace("http:", "ws:")}`;
const allowedDevOrigins = isProduction
  ? []
  : Array.from(new Set([
      "10.0.2.2",
      ...Object.values(networkInterfaces()).flatMap((addresses) =>
        addresses?.flatMap((address) =>
          address.family === "IPv4" && !address.internal ? [address.address] : [],
        ) ?? [],
      ),
    ]));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      `img-src 'self' data: blob: https://*.supabase.co${localSupabaseHttpSources} https://lh3.googleusercontent.com https://images.unsplash.com https://api.dicebear.com https://api.maptiler.com`,
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${localSupabaseHttpSources}${localSupabaseWebSocketSources} https://api.maptiler.com https://challenges.cloudflare.com https://*.ingest.sentry.io`,
      "worker-src 'self' blob:",
      "frame-src https://challenges.cloudflare.com https://meet.jit.si",
      isProduction ? "upgrade-insecure-requests" : "",
    ].filter(Boolean).join("; "),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: 'camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=(self), payment=()' },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Next's separate development debug stream can leave document hydration
  // waiting after repeated navigations. Keep those records in the RSC payload.
  ...(!isProduction ? { experimental: { reactDebugChannel: false } } : {}),
  // Separate disposable verification servers from the active local preview.
  distDir: process.env.NODE_ENV === "development" && /^\.next-pinpoint-verify-[a-z0-9-]+$/.test(process.env.PINPOINT_LOCAL_VERIFY_DIST_DIR ?? "") ? process.env.PINPOINT_LOCAL_VERIFY_DIST_DIR : ".next",
  allowedDevOrigins,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    loader: "custom",
    loaderFile: "./cloudflare-image-loader.ts",
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [64, 96, 144, 220, 320, 480],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qleeedwnnfvmfjjymoco.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/auth",
        permanent: false,
      },
      {
        source: "/signup",
        destination: "/auth",
        permanent: false,
      },
      {
        source: "/register",
        destination: "/auth",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/offers/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
