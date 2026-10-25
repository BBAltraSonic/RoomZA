import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a = -1, b = -1, c = -1, d = -1] = parts;
  // IANA special-purpose registry: retain the two globally reachable /32
  // exceptions within 192.0.0.0/24, and refuse non-global assignments.
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0 && d !== 9 && d !== 10)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

function blockedIpv6(address: string) {
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  const [head = "", tail = ""] = normalized.split("::");
  const left = head ? head.split(":") : [], right = tail ? tail.split(":") : [];
  const words = [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right].map((word) => Number.parseInt(word, 16));
  const [first = 0, second = 0] = words;
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  const translated = first === 0x64 && second === 0xff9b && words.slice(2, 6).every((word) => word === 0);
  if (mapped || translated) {
    const high = words[6]!, low = words[7]!;
    return blockedIpv4(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  // IANA currently allocates ordinary global unicast in 2000::/3.
  // Translation and mapped addresses above must also have public IPv4 targets.
  if ((first & 0xe000) !== 0x2000) return true;
  if (first === 0x2002 || first === 0x3ffe || (first === 0x2001 && second === 0x0db8) || (first === 0x3fff && (second & 0xf000) === 0)) return true;
  if (first === 0x2001 && (second & 0xfe00) === 0) {
    const anycast = second === 1 && words.slice(2, 7).every((word) => word === 0) && [1, 2, 3].includes(words[7]!);
    const globallyReachable = anycast || second === 3 || (second === 4 && words[2] === 0x112) || (second >= 0x20 && second <= 0x3f);
    return !globallyReachable;
  }
  return false;
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4(address);
  if (family === 6) {
    try { return !blockedIpv6(address); } catch { return false; }
  }
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

export function detectImageMime(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

