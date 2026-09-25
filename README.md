# Photo Planet 🌏📷

Mỗi chuyến đi là một hành tinh nhỏ. Đi bộ quanh hành tinh, tới từng nơi đã ghé để xem ảnh chụp ở đó.
Hành tinh đầu tiên là **đảo Sado (佐渡島)**, chụp ngày 19–20.09.2026.

Dựng bằng [three.js](https://threejs.org) + Vite, không dùng model hay texture ngoài: mọi thứ (địa hình, nhà, cây, thuyền thúng, torii…) đều được dựng bằng code, tô toon + viền mực kiểu tranh vẽ tay.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # xuất bản ra dist/ (static, host ở đâu cũng được)
```

## Điều khiển

| | Máy tính | Điện thoại |
|---|---|---|
| Đi | `WASD` / phím mũi tên, hoặc click xuống đất | Chạm xuống đất |
| Chạy | giữ `Shift` | – |
| Xoay camera | kéo chuột | kéo 1 ngón |
| Thu phóng | cuộn chuột (thu hết cỡ → toàn cảnh hành tinh) | chụm 2 ngón |
| Xem ảnh | tới gần địa điểm rồi bấm `E`, hoặc click thẳng vào landmark | chạm vào bong bóng "Xem ảnh" |
| Toàn cảnh / nhật ký | `M` / `J` | nút bên phải |

Link thẳng tới một địa điểm: `…/#futatsugame` (id lấy trong `src/data/trips.js`).

## Thêm ảnh / địa điểm

1. Bỏ ảnh gốc (JPG) vào `images/`.
2. `npm run photos` → sinh bản webp tối ưu (2000px, 1200px, thumbnail) vào `public/photos/` và đọc EXIF (máy, ống kính, khẩu, tốc, ISO, ngày chụp) vào `src/data/photo-meta.json`.
3. Khai báo trong `src/data/trips.js`:

```js
{
  id: 'ten-dia-diem',
  name: 'Tên hiển thị',
  nameJp: '日本語名',
  lat: 20, lon: 60,           // vị trí trên hành tinh (độ) — không phải GPS thật
  landmark: 'shelter',        // kiểu mô hình 3D, xem src/world/landmarks.js
  facing: 'sea',              // hướng landmark nhìn ra (độ) hoặc 'sea' = tự quay ra biển
  flat: { r: 3.5, h: 0.3 },   // san phẳng địa hình quanh đó
  blurb: 'Vài dòng giới thiệu…',
  photos: [{ id: 'DSC01234', caption: 'Chú thích ảnh' }],
}
```

Muốn landmark mới thì thêm 1 hàm vào `BUILDERS` trong `src/world/landmarks.js` (dựng bằng `GeoBuilder` + `f.put(...)`), và góc đứng xem trong `VIEWS`.

Chuyến đi mới = thêm 1 phần tử vào `TRIPS` (biển, núi, địa điểm, đường đi riêng). Hiện app hiển thị `TRIPS[0]`.

## Cấu trúc

```
src/
  data/trips.js         dữ liệu chuyến đi, địa điểm, ảnh
  data/photo-meta.json  EXIF (sinh tự động)
  world/terrain.js      hàm độ cao hành tinh (biển, núi, ruộng) + mesh
  world/landmarks.js    mô hình từng địa điểm
  world/world.js        đường làng, cột điện, cây cỏ, mây, mòng biển, phà
  world/sky.js          bầu trời vệt cọ, nước biển, bụi lơ lửng
  world/toon.js         vật liệu toon, viền mực, hiệu ứng nhìn xuyên vật cản
  player/               nhân vật (texture vẽ tay bằng canvas trong paint.js) + di chuyển trên mặt cầu
  core/rig.js           camera đi dạo ⇄ toàn cảnh hành tinh
  core/audio.js         âm thanh nền tự sinh (sóng biển, chuông gió)
  ui/ui.js              HUD, album ảnh, nhật ký
scripts/build-photos.mjs  tối ưu ảnh + đọc EXIF
```

## Deploy

`npm run build` rồi đẩy thư mục `dist/` lên GitHub Pages / Netlify / Vercel / Cloudflare Pages. Build dùng đường dẫn tương đối nên chạy được cả trong thư mục con.
