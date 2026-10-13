import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pinpoints",
    short_name: "Pinpoints",
    description: "Find your next rental in South Africa.",
    start_url: "/",
    display: "standalone",
    background_color: "#E3F2FD",
    theme_color: "#E3F2FD",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
