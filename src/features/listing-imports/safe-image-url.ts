import "server-only";

import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

import { IMPORT_LIMITS } from "./limits";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a = -1, b = -1] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function blockedIpv6(address: string) {
  const normalized = address.toLowerCase();
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("::ffff:127.")
    || normalized.startsWith("::ffff:10.")
    || normalized.startsWith("::ffff:192.168.")
    || normalized.startsWith("::ffff:169.254.");
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4(address);
  if (family === 6) return !blockedIpv6(address);
  return false;
}

export function parseSafeImageUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("Image URLs must use HTTPS.");
  if (url.username || url.password) throw new Error("Image URLs cannot contain credentials.");
  if (url.port && url.port !== "443") throw new Error("Image URLs cannot use a custom port.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("This image host is not allowed.");
  }
  return url;
}

async function assertPublicHost(url: URL) {
  if (isIP(url.hostname)) {
    if (!isPublicAddress(url.hostname)) throw new Error("Private-network image URLs are not allowed.");
    return;
  }
  const [ipv4, ipv6] = await Promise.all([
    resolve4(url.hostname).catch(() => []),
    resolve6(url.hostname).catch(() => []),
  ]);
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("The image host does not resolve to a public address.");
  }
}

export function detectImageMime(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function fetchSafeImage(input: string) {
  let url = parseSafeImageUrl(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertPublicHost(url);
    const response = await fetch(url, {
      redirect: "manual",
      headers: { accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("The image URL redirected too many times.");
      url = parseSafeImageUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok || !response.body) throw new Error("The image could not be downloaded.");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > IMPORT_LIMITS.imageBytes) throw new Error("Images are limited to 10 MB.");
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > IMPORT_LIMITS.imageBytes) throw new Error("Images are limited to 10 MB.");
    const mimeType = detectImageMime(buffer);
    if (!mimeType) throw new Error("The downloaded file is not a supported image.");
    return { bytes: buffer, mimeType, finalUrl: url };
  }
  throw new Error("The image could not be downloaded.");
}
