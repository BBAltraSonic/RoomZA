/**
 * A small ZIP writer for server-made archives (privacy exports). It uses the
 * platform's CompressionStream, which Cloudflare Workers and Node both provide,
 * so the Worker bundle carries no zip library. Writes classic ZIP (no ZIP64):
 * fine below 4 GiB and 65,535 entries, far above the export size limit.
 */

export type ZipEntry = { name: string; data: Uint8Array | string };

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** MS-DOS time and date fields, in the server's local time as ZIP expects. */
function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const FLAG_UTF8_NAMES = 1 << 11;

export async function createZipArchive(entries: ZipEntry[], modifiedAt = new Date()): Promise<Uint8Array> {
  if (entries.length > 0xffff) throw new Error("zip_too_many_entries");
  const { time, day } = dosDateTime(modifiedAt);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const raw = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const deflated = raw.length ? await deflateRaw(raw) : raw;
    // Store when deflate does not help (already-compressed photos and PDFs).
    const method = deflated.length < raw.length ? METHOD_DEFLATE : METHOD_STORE;
    const body = method === METHOD_DEFLATE ? deflated : raw;
    const crc = crc32(raw);
    if (offset + 30 + name.length + body.length > 0xffffffff) throw new Error("zip_too_large");

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, FLAG_UTF8_NAMES, true);
    local.setUint16(8, method, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    localParts.push(new Uint8Array(local.buffer), name, body);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, FLAG_UTF8_NAMES, true);
    central.setUint16(10, method, true);
    central.setUint16(12, time, true);
    central.setUint16(14, day, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, body.length, true);
    central.setUint32(24, raw.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + body.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
  const archive = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of parts) {
    archive.set(part, at);
    at += part.length;
  }
  return archive;
}
