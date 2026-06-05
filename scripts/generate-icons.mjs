import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svg = await readFile(join(root, 'public', 'icon.svg'));
const outDir = join(root, 'public', 'icon');

await mkdir(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  await writeFile(join(outDir, `${size}.png`), png);
}

console.log('Generated icons in public/icon/');
