import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { PinpointMark } from "../../src/components/pinpoint-mark";

// Generate every icon from the same vector used beside the Pinpoint wordmark.
const root = resolve(__dirname, "../..");
const svg = renderToStaticMarkup(<PinpointMark foreground="#173d2a" accent="#52774b" />);
const darkSvg = renderToStaticMarkup(<PinpointMark foreground="#b0d2bc" accent="#d0e1a9" />);
const save = (path: string, data: string | Buffer) => writeFile(resolve(root, path), data);
const png = (source: string, size: number) => sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

async function main() {
  for (const path of ["src/app/icon.svg", "public/icon.svg", "public/logo.svg"]) await save(path, svg + "\n");
  await save("public/icon.png", await png(svg, 512));
  await save("public/apple-touch-icon.png", await png(svg, 180));
  await save("public/pinpoint-logo-icon-light.png", await png(svg, 512));
  await save("public/pinpoint-logo-icon-dark.png", await png(darkSvg, 512));

  // ICO supports embedded PNG frames; include actual tab sizes for sharp curves.
  const sizes = [16, 32, 48] as const;
  const frames = await Promise.all(sizes.map(size => png(svg, size)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index]!;
    header[entry + 1] = sizes[index]!;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await save("public/favicon.ico", Buffer.concat([header, ...frames]));
  console.log(`Generated Pinpoint icons in ${root}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
