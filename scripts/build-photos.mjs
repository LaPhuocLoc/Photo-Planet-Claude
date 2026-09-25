// Tối ưu ảnh gốc trong images/ thành webp cho web + trích EXIF.
// Chạy: npm run photos
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const SRC = 'images';
const OUT = 'public/photos';
const META = 'src/data/photo-meta.json';
const SIZES = { full: 2000, mid: 1200, thumb: 480 };

const files = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g)$/i.test(f));
await fs.mkdir(OUT, { recursive: true });

const meta = {};
for (const file of files) {
  const id = path.parse(file).name;
  const src = path.join(SRC, file);
  const img = sharp(src).rotate();
  const { width, height } = await img.metadata();

  await img.clone().resize({ width: SIZES.full, height: SIZES.full, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 }).toFile(path.join(OUT, `${id}.webp`));
  await img.clone().resize({ width: SIZES.mid, height: SIZES.mid, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }).toFile(path.join(OUT, `${id}-1200.webp`));
  await img.clone().resize({ width: SIZES.thumb, height: SIZES.thumb, fit: 'inside' })
    .webp({ quality: 72 }).toFile(path.join(OUT, `${id}-thumb.webp`));

  const e = (await exifr.parse(src, {
    pick: ['Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal'],
  })) || {};
  meta[id] = {
    w: width,
    h: height,
    camera: e.Model || null,
    lens: e.LensModel || null,
    f: e.FNumber ?? null,
    shutter: e.ExposureTime ? (e.ExposureTime >= 1 ? `${e.ExposureTime}s` : `1/${Math.round(1 / e.ExposureTime)}s`) : null,
    iso: e.ISO ?? null,
    focal: e.FocalLength ? Math.round(e.FocalLength) : null,
    date: e.DateTimeOriginal ? new Date(e.DateTimeOriginal).toISOString() : null,
  };
  console.log('✓', id);
}
await fs.writeFile(META, JSON.stringify(meta, null, 2) + '\n');
console.log(`Done: ${files.length} photos → ${OUT}`);
