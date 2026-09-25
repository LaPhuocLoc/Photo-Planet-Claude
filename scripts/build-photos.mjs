// Tối ưu ảnh gốc thành webp cho web + trích EXIF, theo từng đảo.
//   images/<trip-id>/*.jpg  →  public/photos/<trip-id>/<id>.webp (2000px), <id>-1200.webp, <id>-thumb.webp
//                           →  src/trips/<trip-id>/photo-meta.json
// Chạy: npm run photos            (mọi đảo)
//       npm run photos -- sado    (chỉ 1 đảo — nhanh hơn khi có nhiều đảo)
// Ảnh đã có webp mới hơn ảnh gốc thì bỏ qua (chạy lại rất nhanh).
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const SRC = 'images';
const OUT = 'public/photos';
const SIZES = { full: 2000, mid: 1200, thumb: 480 };

const only = process.argv[2];
const dirs = (await fs.readdir(SRC, { withFileTypes: true })).filter((d) => d.isDirectory() && (!only || d.name === only)).map((d) => d.name);
const loose = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g)$/i.test(f));
if (loose.length) console.warn(`⚠ Bỏ qua ${loose.length} ảnh nằm thẳng trong images/ — hãy đặt vào images/<trip-id>/`);

const newer = async (a, b) => {
  try {
    return (await fs.stat(b)).mtimeMs >= (await fs.stat(a)).mtimeMs;
  } catch {
    return false;
  }
};

for (const trip of dirs) {
  const src = path.join(SRC, trip);
  const out = path.join(OUT, trip);
  const metaFile = path.join('src/trips', trip, 'photo-meta.json');
  await fs.mkdir(out, { recursive: true });
  await fs.mkdir(path.dirname(metaFile), { recursive: true });
  let old = {};
  try {
    old = JSON.parse(await fs.readFile(metaFile, 'utf8'));
  } catch {
    /* chưa có */
  }
  const files = (await fs.readdir(src)).filter((f) => /\.(jpe?g)$/i.test(f)).sort();
  const meta = {};
  let made = 0;
  for (const file of files) {
    const id = path.parse(file).name;
    const input = path.join(src, file);
    const full = path.join(out, `${id}.webp`);
    if (old[id] && (await newer(input, full))) {
      meta[id] = old[id];
      continue;
    }
    const img = sharp(input).rotate();
    const { width, height } = await img.metadata();
    const scale = Math.min(1, SIZES.full / Math.max(width, height));
    await img.clone().resize({ width: SIZES.full, height: SIZES.full, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(full);
    await img.clone().resize({ width: SIZES.mid, height: SIZES.mid, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(out, `${id}-1200.webp`));
    await img.clone().resize({ width: SIZES.thumb, height: SIZES.thumb, fit: 'inside' }).webp({ quality: 72 }).toFile(path.join(out, `${id}-thumb.webp`));
    const e = (await exifr.parse(input, { pick: ['Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal'] })) || {};
    meta[id] = {
      w: Math.round(width * scale),
      h: Math.round(height * scale),
      camera: e.Model || null,
      lens: e.LensModel || null,
      f: e.FNumber ?? null,
      shutter: e.ExposureTime ? (e.ExposureTime >= 1 ? `${e.ExposureTime}s` : `1/${Math.round(1 / e.ExposureTime)}s`) : null,
      iso: e.ISO ?? null,
      focal: e.FocalLength ? Math.round(e.FocalLength) : null,
      date: e.DateTimeOriginal ? new Date(e.DateTimeOriginal).toISOString() : null,
    };
    made++;
    console.log('✓', `${trip}/${id}`);
  }
  await fs.writeFile(metaFile, JSON.stringify(meta, null, 2) + '\n');
  console.log(`${trip}: ${files.length} ảnh (${made} mới) → ${out}`);
}
