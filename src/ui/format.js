// Định dạng thông tin ảnh (EXIF) dùng chung cho album desktop và trình xem ảnh mobile.
export const CAMERA_NAMES = { 'ILCE-7M5': 'Sony α7 V', 'ILCE-7M4': 'Sony α7 IV', 'ILCE-7CM2': 'Sony α7C II' };
export const cameraName = (c) => CAMERA_NAMES[c] || c || null;
export const lensName = (l) => (l ? l.replace(/\s*\d{3}$/, '').replace('Contemporary', 'C') : null);

const TZ = 'Asia/Tokyo';
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
// "Thứ Bảy, 19 tháng 9, 2026"
export const fmtLongDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;
// "09:43"
export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : null;
