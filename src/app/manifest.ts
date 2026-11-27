import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pinpoint",
    short_name: "Pinpoint",
    description: "Discover homes, shopping specials, places, and events across South Africa.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F0EC",
    theme_color: "#151A24",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
