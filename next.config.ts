import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
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
    ],
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/dashboard",
        permanent: false,
      },
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
};

export default nextConfig;
