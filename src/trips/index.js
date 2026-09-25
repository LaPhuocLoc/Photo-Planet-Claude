// Danh sách hành tinh — thứ DUY NHẤT về các đảo nằm trong gói JS chính.
// Mỗi mục chỉ vài trăm byte; dữ liệu chi tiết + landmark + ảnh của đảo nằm ở
// src/trips/<id>/ và chỉ được tải (dynamic import → chunk riêng) khi mở đảo đó.
// → 50 đảo thì lần tải đầu vẫn nặng như 1 đảo.
//
// Mở đảo: ?trip=<id>   (không có → đảo đầu danh sách). Link địa điểm: ?trip=<id>#<placeId>
// Chuyển đảo = tải lại trang với ?trip=… → bộ nhớ GPU/JS của đảo cũ được giải phóng sạch.

export const TRIP_LIST = [
  {
    id: 'sado',
    title: 'Sado',
    titleJp: '佐渡島',
    region: 'Niigata · Nhật Bản',
    dates: '19 – 20.09.2026',
    intro:
      'Hòn đảo lớn ngoài khơi Niigata — ruộng lúa chín vàng, tàn tích mỏ vàng phủ dây leo, và biển xanh trong vắt ở tận cùng phía bắc.',
    cover: 'photos/sado/DSC01663-thumb.webp',
    load: () => import('./sado/index.js'),
  },
];

export function currentTripId() {
  const q = new URLSearchParams(location.search).get('trip');
  return TRIP_LIST.some((t) => t.id === q) ? q : TRIP_LIST[0].id;
}

export async function loadTrip(id) {
  const entry = TRIP_LIST.find((t) => t.id === id) ?? TRIP_LIST[0];
  const mod = await entry.load();
  const trip = mod.default;
  return { ...trip, photoDir: trip.photoDir ?? `photos/${trip.id}` };
}

export const tripUrl = (id, placeId) => `${location.pathname}?trip=${encodeURIComponent(id)}${placeId ? `#${placeId}` : ''}`;
