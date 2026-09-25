// Chụp màn hình kiểm tra game bằng Chromium headless (dùng cho agent / khi dev).
//
// Chuẩn bị (1 lần, KHÔNG thêm playwright vào package.json):
//   mkdir -p <scratch> && cd <scratch> && npm i playwright@1 --silent
//   cp <repo>/scripts/verify/tour.mjs <scratch>/verify.mjs   (ESM tìm package theo vị trí file,
//   nên phải chạy bản copy nằm cạnh node_modules/playwright)
//   Cần dev server chạy nền: cd <repo> && nohup npx vite --port 5173 --strictPort > <scratch>/vite.log 2>&1 &
//   Chạy: cd <scratch> && OUT=<scratch> node verify.mjs
//
// Tham số: node tour.mjs [placeId,placeId,...]   (mặc định: tất cả địa điểm)
// Biến môi trường:
//   BASE=http://localhost:5173/   OUT=thư mục lưu ảnh (mặc định cwd)
//   W=1280 H=800                  MOBILE=1 → giả lập điện thoại 390x844 cảm ứng
//   WAIT=2500                     ms chờ trước khi chụp (headless render bằng CPU nên rất chậm)
//   VIEW=explore|planet|front|gallery
//       explore: góc chơi mặc định   planet: toàn cảnh hành tinh
//       front:   camera quay ra trước mặt nhân vật   gallery: mở album địa điểm
//   EXTRA="js…"                   đoạn JS chạy thêm sau khi tới địa điểm
//   CHROMIUM=/opt/pw-browsers/chromium
//
// In ra: lỗi console/shader, số draw call + tam giác mỗi cảnh.
// LƯU Ý: headless rất chậm → transition CSS/opacity đọc ra có thể chưa xong.
// Kiểm tra kết quả bằng ẢNH (hoặc document.elementFromPoint), đừng chỉ tin class/opacity.
import { chromium } from 'playwright';

const env = process.env;
const ids = process.argv[2] ? process.argv[2].split(',') : null;
const mobile = env.MOBILE === '1';
const view = env.VIEW || 'explore';
const out = env.OUT || '.';
const browser = await chromium.launch({
  executablePath: env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage(
  mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: +(env.W || 1280), height: +(env.H || 800) } },
);
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'debug' || t.includes('CERT') || t.includes('[vite]')) return;
  if (m.type() === 'error' || m.type() === 'warning' || t.startsWith('[stat]')) logs.push(`[${m.type()}] ${t.split('\n').filter((l) => /ERROR|stat|rror/.test(l) || l.length < 160).slice(0, 4).join(' | ')}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(env.BASE || 'http://localhost:5173/');
await page.waitForFunction(() => window.__planet?.world, null, { timeout: 120000 });
await page.evaluate(() => window.__planet.start());
const list = ids ?? (await page.evaluate(() => window.__planet.world.places.map((p) => p.id)));

for (const id of list) {
  await page.evaluate(
    ([id, view]) => {
      const P = window.__planet;
      P.ui.closeGallery();
      P.goto(id);
      const r = P.rig;
      if (view === 'front') {
        r.heading.applyAxisAngle(P.player.dir, 2.6);
        r.dist = r.distTarget = 2.8;
        r.pitch = 0.12;
      } else if (view === 'planet') {
        r.setMode('planet');
        r.blend = 1;
        r.orbitDist = r.orbitDistTarget = 60;
      } else if (view === 'gallery') P.ui.openGallery(id, 0);
    },
    [id, view],
  );
  if (env.EXTRA) await page.evaluate(env.EXTRA);
  await page.waitForTimeout(+(env.WAIT || 2500));
  const stat = await page.evaluate(() => {
    const i = window.__planet.renderer.info.render;
    return `calls=${i.calls} tris=${i.triangles}`;
  });
  const file = `${out}/${view}-${id}${mobile ? '-mobile' : ''}.png`;
  await page.screenshot({ path: file });
  console.log(`${id}: ${stat} → ${file}`);
}
if (logs.length) console.log('\n--- console ---\n' + [...new Set(logs)].slice(0, 30).join('\n'));
await browser.close();
