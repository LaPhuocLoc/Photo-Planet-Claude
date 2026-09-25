# Sổ tay làm đảo — Photo Planet

Kinh nghiệm đúc kết từ lúc dựng đảo **Sado** (hành tinh đầu tiên). Agent `island-creator` và
`island-editor` **phải đọc hết file này trước khi làm**. Có bài học mới thì bổ sung vào đây.

---

## 0. Chủ nhà là ai, muốn gì

- Chủ project là **nhiếp ảnh gia**. Mỗi chuyến đi = 1 hành tinh nhỏ; mỗi nơi đã ghé = 1 landmark 3D;
  tới gần thì mở album ảnh thật đã chụp ở đó. Mục đích: **khoe hành trình + ảnh**, và người xem phải thấy "wow".
- **Ngôn ngữ**: trả lời tiếng Việt, thân mật (tao/mày), thẳng vào việc, không lan man.
  Nói rõ **mức độ chắc chắn + giả định** khi đoán (nhất là đoán địa điểm trong ảnh).
- **Phong cách bắt buộc**: Ghibli / vẽ tay, mềm, minimalist, dễ thao tác. Tham chiếu: game
  kiểu *Sable / Tiny Glade / "hành tinh nhỏ"*: cel-shading, viền mực, trời xanh ngọc có vệt mây quét cọ,
  vách đá màu be phủ rêu, cây có chạc nhánh, nhiều sự sống.
- **Những lần bị chê** (đừng lặp lại):
  1. Nhân vật "như Roblox" (khối capsule, đầu to) → phải tỉ lệ người thật hơn, mặt vẽ tay bằng texture,
     tóc từng lọn, cel 2 tông.
  2. "Sơ sài" → thiếu người, côn trùng, hoa, cây đa dạng, địa hình phẳng lì.
  3. Landmark sai bố cục so với ảnh (cầu đỏ lúc đầu chạy ra đảo thay vì bắc ngang 2 bờ nhìn ra biển).
  4. Ảnh album bị mờ (bug thật, xem §6).
  5. Mobile bấm đi lại mở nhầm album (vùng click tàng hình quá to).

## 1. Bản đồ code

```
src/data/trips.js          TRIPS[]: mỗi chuyến đi = { id, title, titleJp, region, dates, intro,
                           planet{radius, seed, seas[], hills[]}, spawn, places[], route[] }
src/data/photo-meta.json   EXIF sinh tự động (npm run photos) — KHÔNG sửa tay
images/                    ảnh gốc (JPG). id ảnh = tên file bỏ đuôi
public/photos/             webp sinh tự động: <id>.webp (2000px), <id>-1200.webp, <id>-thumb.webp
scripts/build-photos.mjs   tối ưu ảnh + đọc EXIF (sharp + exifr)
scripts/verify/tour.mjs    chụp màn hình kiểm tra (xem §7)
src/main.js                renderer, input (chuột/cảm ứng/phím), vòng lặp, travel, debug window.__planet
src/world/terrain.js       hàm độ cao giải tích: biển (seas), núi (hills), san phẳng (flats), mỏm đá (ledges),
                           gồ ghề + bậc thềm; màu theo đỉnh; ruộng (paddyAt); shader tranh vẽ + bọt sóng
src/world/landmarks.js     BUILDERS{kiểu: (f, world) => …} dựng landmark; VIEWS (góc đứng xem); LEDGES;
                           model cầu, torii, thuyền thúng, nhà thuyền, trạm chờ, tàn tích…
src/world/world.js         lắp ráp: đường làng + cột điện + bậc thang dốc, rải cây/đá/cỏ/nhà (chunk instancing),
                           mây, mòng biển, phà, decks (mặt đi được: cầu), heightAt/walkable
src/world/life.js          sự sống: villager(), mèo, xe buýt, xe đạp, máy gặt, thuyền đánh cá, hoa, chuồn chuồn, bướm,
                           Jizo, đèn đá. Bảng people/cats/boatSpots đang khoá theo KIỂU landmark (xem §8)
src/world/models.js        cây (tree 0/1/2, matsu, pine), bụi, đá, boulder(seed, kind), nhà, cột điện, mây, phà…
src/world/toon.js          vật liệu toon 3 tông + 2 tông, viền mực inverted-hull, GeoBuilder, windMaterial(leaf),
                           occlusion (vật giữa camera–nhân vật tự dither)
src/world/surface.js       SurfaceFrame: đặt vật lên mặt cầu theo toạ độ cục bộ (x ngang, z phía trước)
src/world/sky.js           bầu trời vệt cọ, nước biển, bụi lơ lửng
src/player/character.js    nhân vật chính (nhiếp ảnh gia) + paint.js (texture vẽ tay: mặt, áo, jean)
src/core/rig.js            camera đi dạo ⇄ toàn cảnh; hướng nắng luôn "buổi trưa" quanh người chơi
src/ui/ui.js + style.css   HUD, album (EXIF, srcset, preload), nhật ký, pin, toast; mobile dock
```

## 2. Quy trình biến ảnh → địa điểm

1. **Xem hết từng ảnh** (Read ảnh). Đọc EXIF bằng exifr (máy, ống, khẩu, tốc, ISO, ngày giờ).
   Ảnh người dùng upload qua chat thường **mất EXIF** — vẫn dùng được, album tự ẩn thông số.
2. **Sắp theo thời gian chụp** → ra thứ tự hành trình (chặng 1, 2, …). Giờ EXIF hiển thị theo
   múi giờ nơi chụp (`fmtDate` trong ui.js đang dùng `Asia/Tokyo` — đổi nếu đảo ở nước khác).
3. **Nhận diện địa điểm** từ nội dung ảnh + kiến thức địa lý. Ghi rõ độ chắc chắn.
   Chỗ không chắc → đặt tên chung chung ("Trạm chờ bên bờ biển"), đừng bịa tên riêng.
4. **Gom ảnh** thành 4–8 địa điểm (1–3 ảnh/nơi). Ảnh không phải ảnh chụp thật (infographic, AI) → không đưa vào album.
5. **Caption/blurb**: viết ngắn, tả khách quan, tiếng Việt; KHÔNG bịa kỷ niệm cá nhân. Báo người dùng đây là
   bản nháp để họ sửa.
6. Với mỗi địa điểm, rút ra **"bố cục chữ ký"** của ảnh: vật chính là gì, nằm ở đâu so với người đứng chụp,
   biển/núi ở hướng nào, màu chủ đạo. Landmark 3D phải tái hiện đúng bố cục đó khi đứng ở điểm VIEW.
   Ví dụ đúng: cầu đỏ Yajima — cầu vòm bậc thang **bắc ngang** giữa 2 mỏm đá đen, biển phía sau, nhìn thẳng ra biển.

## 3. Thiết kế hành tinh

- `radius` 24. Người cao ~1.5 đơn vị. Chu vi ~150 → đi hết vòng ~40s. Giữ các con số này cho đồng bộ cảm giác.
- **Đường cong che khuất**: vật cách người chơi > ~8 đơn vị sẽ chìm dưới chân trời. Vật chính của landmark
  đặt trong 4–9 đơn vị từ tâm, làm **to và cao** (Ōnogame: nón cao 11, Futatsugame: 2 đảo đá cao 2.6–3.6).
- `lat/lon` chỉ xếp "na ná" địa lý thật (bắc ở trên…), rải đều để đi bộ giữa các nơi không quá xa/gần.
  Không đặt địa điểm sát cực (lat > 70) vì khung tiếp tuyến bị suy biến.
- `seas`: vùng trũng (lat, lon, r độ, depth). Nơi ven biển: đặt tâm biển cách địa điểm ~20–25° và dùng
  `facing: 'sea'` để landmark tự quay ra biển (World.seaBearing). `hills`: núi (amp 2–3.5).
- `flat: { r, h }`: san phẳng quanh landmark. Ruộng dùng r lớn (7.5). Ven biển r nhỏ (3–3.5) để còn thấy bờ.
- `LEDGES[kiểu]`: mỏm đá (x, z, r, h) cục bộ → địa hình nhô lên, tô màu bazan, không mọc cỏ/cây.
- `route`: thứ tự đi qua các địa điểm (khép vòng về điểm đầu). Đường đi vào **điểm VIEW.at** của từng nơi,
  không xuyên qua landmark (xe buýt từng chạy xuyên torii).
- Địa hình có sẵn: gồ ghề + bậc thềm tự nhiên trên đồi + vách dốc tô đá be/rêu + bậc thang đá tự động ở đoạn đường dốc.
- Mỗi hành tinh nên có **1 đặc sản màu sắc** theo mùa/chuyến đi (Sado: lúa chín vàng + hoa bỉ ngạn đỏ tháng 9).

## 4. Dựng landmark

- Toạ độ cục bộ: `+Z` = hướng `facing` (thường ra biển), `x` = ngang. Lưu ý: `+x` hiện ở **bên trái màn hình**
  khi đứng ở VIEW nhìn về +Z.
- Dùng `f.put(obj, x, z, { rotY, y, water, seabed })` — mỗi vật tự đứng thẳng theo pháp tuyến cầu.
  `water: true` = đặt trên mặt nước nếu dưới nước. Vật dài > 4 đơn vị (cầu) phải trừ độ cong: `y -= x²/(2R)`.
- `f.collide(x, z, r)` cho mọi vật chắn đường. Cây/nhà rải ngẫu nhiên đã tự tránh landmark (pad ~3.5).
- `VIEWS[kiểu] = { at:[x,z], focus:[x,z], pick }`: at = chỗ người chơi đứng khi tới (đứng xa vật chính ~4–6,
  lệch sang 1 bên để nhân vật không che), focus = chỗ nhìn/đặt bong bóng "Xem ảnh".
- Đi lên được (cầu, sàn gỗ…): đẩy vào `world.decks` { center, axis, across, half, width, height(x) } và mesh vào
  `world.walkMeshes` (để click/chạm trúng).
- Thêm hồn cho landmark bằng life.js: người (đúng hoạt động nơi đó: gặt lúa, chụp ảnh, ngồi chờ, chèo thuyền),
  mèo, đèn đá, Jizo, thuyền, chim.
- Model: `GeoBuilder` gộp khối cơ bản (box/cyl/ico/cone/lathe/extrude) có màu đỉnh → `inked(geo, vcToon(), {outline})`.
  Viền: 0.012–0.02 cho đồ nhỏ, 0.025–0.05 cho vật lớn.

## 5. Phong cách đồ hoạ (checklist "chỉn chu")

- Cel-shading: thế giới 3 tông (`toonGradient`), nhân vật/NPC 2 tông (`toonGradient2`), viền mực mọi vật.
- Texture vẽ tay bằng canvas (paint.js): nét hơi run, hạt giấy. Mặt người vẽ bằng texture (mắt hạnh nhân, mày đậm,
  má hồng), không dựng khối mắt.
- Cây: nhiều loại, **cao thấp khác nhau**, thân cong có **chạc nhánh**, tán lổn nhổn (ico detail 1 + méo),
  vân chùm lá (`windMaterial({leaf:true})`), lay theo gió. Ven biển: thông Nhật tán tầng.
- Địa hình không phẳng: dốc, bậc thềm, vách đá be phủ rêu, tảng đá (boulder kind 0/1/2), bậc thang.
- Sống động: người đi dạo/làm việc, xe cộ chạy theo đường, mèo, bướm (có đàn bay quanh người chơi),
  chuồn chuồn, chim, hoa theo mùa, thuyền nhấp nhô, cỏ/lúa lay gió.
- Vật giữa camera và nhân vật tự dither (occlusion). **Nhân vật không bao giờ bị dither** (outline dùng `{occlude:false}`).

## 6. Bug đã gặp — đừng lặp lại

| Bug | Nguyên nhân gốc | Cách tránh |
|---|---|---|
| Ảnh album mờ dù đã tải xong | thumbnail có `filter` + `transform` → stacking context, vẽ **đè** lên ảnh nét dù DOM đứng trước | ảnh nét `position:relative; z-index:1`; ẩn thumbnail khi ảnh nét hiện xong. Kiểm bằng `elementFromPoint` + crop ảnh, không chỉ đọc class |
| Mobile chạm đi lại mở album | picker sphere tàng hình to (2–4.5) | trên cảm ứng: chạm = luôn đi; xem ảnh bằng nút dock dưới màn hình |
| Shader không compile | đặt tên biến `patch` (từ khoá GLSL) | tránh từ khoá: patch, sample, input, output, filter, active… Luôn đọc console sau khi sửa shader |
| Mặt nhân vật lỗ chỗ khi zoom gần | occlusion dither ăn cả nhân vật | vật liệu nhân vật không `withOcclusion` |
| Cây che camera, landmark bị cây bao | rải cây quá sát | pad quanh landmark + occlusion |
| Vật chính landmark "biến mất" | chìm dưới chân trời do độ cong | đặt gần hơn, làm to/cao hơn |
| Hàng nghìn draw call, 2.5M tam giác | InstancedMesh `frustumCulled=false` + tán lá detail 2 | `instances()` đã chia chunk theo vùng + bounding sphere; tán ico detail 1; gộp mesh NPC |
| Sửa `vcToon()` dùng chung làm hỏng mọi vật | đổi `material.side` trên vật liệu cache | cần khác biệt → `toon(0xffffff, { vertexColors:true, …opts })` tạo material riêng |

## 7. Kiểm tra (bắt buộc trước khi commit)

- Dev server: `nohup npx vite --port 5173 --strictPort > <scratch>/vite.log 2>&1 &`
- Chụp: copy `scripts/verify/tour.mjs` vào scratch có playwright (xem đầu file) rồi:
  - `VIEW=explore` mọi địa điểm, `VIEW=planet`, `VIEW=front` (xem nhân vật), `VIEW=gallery`, `MOBILE=1`.
  - **Xem ảnh chụp bằng mắt** (Read png) — đánh giá bố cục so với ảnh gốc, độ "sống", lỗi hiển thị.
- Headless render bằng CPU (swiftshader) → rất chậm: transition/opacity đọc ra thường chưa xong,
  camera chuyển cảnh chưa kịp → dùng `__planet.goto(id)` (ép blend=0) thay vì `travelTo`.
- Debug hook: `window.__planet` = { world, player, rig, renderer, ui, start(), goto(id), travelTo(id), setMap(bool) }.
- Ngân sách hiệu năng (góc chơi thường): **≤ ~700 draw call, ≤ ~1M tam giác** (script in ra `calls/tris`).
- Console không có lỗi shader/pageerror. `npx vite build` phải qua.
- Test logic bằng node khi được: import `src/world/world.js` với `globalThis.document` giả để đo độ cao/walkable.

## 8. Nợ kỹ thuật khi có đảo thứ 2 (island-creator xử lý ở lần đầu)

1. **Chọn chuyến đi**: `main.js` đang cứng `TRIPS[0]`. Cần: `?trip=<id>` trên URL (mặc định chuyến mới nhất
   hoặc Sado), và 1 UI chọn hành tinh (ví dụ nút "Thiên hà" trong HUD → danh sách hành tinh). Link chia sẻ dạng
   `?trip=<id>#<placeId>`. Key localStorage đã theo trip id.
2. **Ảnh theo thư mục chuyến**: tên file máy ảnh (DSC0xxxx) sẽ trùng giữa các chuyến. Chuyến mới để ở
   `images/<trip-id>/`, id ảnh = `<trip-id>/<tên>` (hoặc tiền tố), `build-photos.mjs` phải quét thư mục con và giữ
   nguyên output của Sado (không đổi id ảnh Sado đang dùng).
3. **life.js khoá theo KIỂU landmark** (`byLm.rice`…): 2 đảo cùng dùng kiểu `rice` sẽ lẫn. Chuyển cấu hình người/mèo/
   thuyền/đèn đá sang dữ liệu từng địa điểm trong `trips.js` (ví dụ `place.life = { people:[…], cats:[…], boats:[…] }`)
   hoặc khoá theo place id; giữ nguyên kết quả của Sado.
4. `LEDGES`, `VIEWS`, `TARAI_BRIDGE` cũng theo kiểu landmark → landmark mới đặt tên kiểu riêng, hoặc cho phép
   override trong dữ liệu địa điểm.
5. Tránh đổi code chung theo hướng làm Sado xấu đi: sau khi sửa phải chụp lại Sado để so.

## 9. Git

- Làm trên branch được giao; commit message tiếng Việt, mô tả rõ; push branch.
- **Chỉ đẩy vào `main` khi người dùng yêu cầu rõ** (fast-forward nếu được, không force).
- Ảnh gốc mới cũng commit vào `images/` (người dùng muốn giữ trong repo), webp sinh ra commit vào `public/photos/`.
