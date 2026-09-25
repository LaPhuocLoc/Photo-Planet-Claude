// ─────────────────────────────────────────────────────────────
//  Dữ liệu các chuyến đi. Mỗi chuyến đi = 1 hành tinh nhỏ.
//  Muốn thêm địa điểm/ảnh: bỏ ảnh gốc vào images/, chạy `npm run photos`,
//  rồi khai báo ở đây. Xem README để biết chi tiết.
// ─────────────────────────────────────────────────────────────
//
//  lat/lon: toạ độ trên hành tinh (độ). lat 90 = cực bắc, lon 0 = mặt trước.
//  Không phải toạ độ GPS thật, chỉ xếp "na ná" địa lý cho vui mắt.
//  landmark: kiểu mô hình 3D dựng cho địa điểm (xem src/world/landmarks.js).
//  facing: hướng (độ, 0 = bắc, 90 = đông) mà landmark "nhìn" ra, hoặc 'sea' = tự quay ra biển gần nhất.
//  flat: san phẳng địa hình quanh địa điểm { r: bán kính (đơn vị world), h: độ cao }.

export const TRIPS = [
  {
    id: 'sado',
    title: 'Sado',
    titleJp: '佐渡島',
    region: 'Niigata · Nhật Bản',
    dates: '19 – 20.09.2026',
    intro:
      'Hòn đảo lớn ngoài khơi Niigata — ruộng lúa chín vàng, tàn tích mỏ vàng phủ dây leo, và biển xanh trong vắt ở tận cùng phía bắc.',
    planet: {
      radius: 24,
      seed: 11,
      // biển: vùng trũng xuống dưới mực nước
      seas: [
        { lat: -8, lon: 180, r: 62, depth: 2.6 }, // đại dương phía sau
        { lat: 16, lon: -86, r: 30, depth: 2.2 }, // biển phía tây (Aikawa)
        { lat: 60, lon: -42, r: 22, depth: 2.2 }, // bờ bắc (Ōnogame)
        { lat: 62, lon: 68, r: 25, depth: 2.4 }, // mũi bắc (Futatsugame)
        { lat: -6, lon: 76, r: 26, depth: 2.2 }, // vịnh phía đông
        { lat: -70, lon: 12, r: 28, depth: 2.3 }, // biển phía nam (Ogi)
      ],
      // núi / đồi
      hills: [
        { lat: 30, lon: 12, r: 15, amp: 3.4 }, // dãy Ōsado
        { lat: 34, lon: 50, r: 12, amp: 2.6 },
        { lat: 28, lon: -24, r: 11, amp: 2.4 },
        { lat: -22, lon: -16, r: 14, amp: 2.2 }, // dãy Kosado
        { lat: -26, lon: 34, r: 11, amp: 1.8 },
        { lat: 4, lon: 130, r: 12, amp: 2.4 },
        { lat: 40, lon: 150, r: 9, amp: 3.2 }, // đảo nhỏ giữa đại dương
        { lat: -40, lon: -150, r: 8, amp: 3.0 },
        { lat: -52, lon: 90, r: 14, amp: 2.2 },
        { lat: 70, lon: 180, r: 16, amp: 2.4 },
      ],
    },
    spawn: 'kuninaka',
    places: [
      {
        id: 'kuninaka',
        name: 'Đồng lúa Kuninaka',
        nameJp: '国中平野',
        lat: 8,
        lon: 2,
        landmark: 'rice',
        facing: 0,
        flat: { r: 7.5, h: 0.32 },
        blurb:
          'Đồng bằng nằm giữa hai dãy núi của đảo. Cuối tháng chín lúa chín vàng, máy gặt chạy khắp nơi, xe tải nhỏ đỗ ngay bờ ruộng.',
        photos: [
          { id: 'DSC00567', caption: 'Chiếc xe tải nhỏ giữa đồng lúa đang gặt' },
          { id: 'DSC01621', caption: 'Dãy núi Ōsado phía sau cánh đồng chín' },
          { id: 'DSC01555', caption: 'Giấc trưa trên xe kéo, cạnh chiếc máy cày cam' },
        ],
      },
      {
        id: 'kitazawa',
        name: 'Nhà máy tuyển nổi Kitazawa',
        nameJp: '北沢浮遊選鉱場跡',
        lat: 20,
        lon: -46,
        landmark: 'ruins',
        facing: 110,
        flat: { r: 4.5, h: 0.4 },
        blurb:
          'Tàn tích của mỏ vàng Sado. Những tầng bê tông cũ giờ phủ kín dây leo, trông như một lâu đài bị rừng nuốt mất.',
        photos: [
          { id: 'DSC00689', caption: 'Những bậc thang bê tông phủ đầy dây leo' },
          { id: 'DSC00724', caption: 'Bể lắng tròn — vòm cột như một ngôi đền' },
        ],
      },
      {
        id: 'bus-stop',
        name: 'Trạm chờ bên bờ biển',
        nameJp: '海辺のバス停',
        lat: -6,
        lon: 44,
        landmark: 'shelter',
        facing: 'sea',
        flat: { r: 3.2, h: 0.28 },
        blurb:
          'Một trạm chờ xe buýt nhỏ màu trắng, lưng quay ra biển. Buổi sáng yên đến mức chỉ còn tiếng sóng.',
        photos: [{ id: 'DSC01125', caption: 'Đợi xe, hay chỉ đứng ngắm biển' }],
      },
      {
        id: 'taraibune',
        name: 'Taraibune · Yajima – Kyōjima',
        nameJp: 'たらい舟・矢島経島',
        lat: -40,
        lon: 8,
        landmark: 'taraibune',
        facing: 'sea',
        flat: { r: 3.2, h: 0.24 },
        blurb:
          'Thuyền thúng gỗ truyền thống của Sado, lướt trên làn nước trong đến mức nhìn thấy cả đáy. Nhà thuyền dựng sát mép nước.',
        photos: [{ id: 'DSC01339', caption: 'Thuyền thúng trên mặt nước ngọc bích' }],
      },
      {
        id: 'futatsugame',
        name: 'Futatsugame',
        nameJp: '二ツ亀',
        lat: 49,
        lon: 34,
        landmark: 'futatsugame',
        facing: 'sea',
        flat: { r: 3.4, h: 0.5 },
        blurb:
          '"Hai con rùa" — hai hòn đảo nối với bờ bằng một dải cát mỏng ở cực bắc Sado. Nhìn từ trên đồi xuống, biển xanh tới mức không thật.',
        photos: [{ id: 'DSC01663', caption: 'Dải cát nối ra hòn rùa, nhìn từ trên đồi' }],
      },
      {
        id: 'onogame',
        name: 'Ōnogame',
        nameJp: '大野亀',
        lat: 44,
        lon: -14,
        landmark: 'onogame',
        facing: 'sea',
        flat: { r: 3.6, h: 0.45 },
        blurb:
          'Khối đá hình rùa khổng lồ cao 167m bên bờ biển. Cổng torii gỗ cũ đứng giữa đồng cỏ, dẫn lối lên núi.',
        photos: [{ id: 'DSC01769', caption: 'Cổng torii dưới chân Ōnogame' }],
      },
    ],
    // đường đi nối các địa điểm (theo thứ tự)
    route: ['kuninaka', 'kitazawa', 'onogame', 'futatsugame', 'bus-stop', 'taraibune', 'kuninaka'],
  },
];
