type CloudflareImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export default function cloudflareImageLoader({ src, width, quality }: CloudflareImageLoaderProps) {
  const origin = normalizeOrigin(process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_TRANSFORM_ORIGIN);

  if (!origin || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  const params = [`width=${width}`, `quality=${quality ?? 75}`, "format=auto", "fit=cover"].join(",");
  const source = src.startsWith("/") ? src : `/${src}`;

  return `${origin}/cdn-cgi/image/${params}${source}`;
}
