import type { Order } from '../types';

const KEY = 'coolmate_orders_v1';

const seedOrders: Order[] = [
  {
    id: 'DH123456',
    createdAt: '2026-03-10T10:30:00Z',
    status: 'shipping',
    total: 958000,
    paymentMethod: 'VNPAY',
    addressSummary: 'Anh Thịnh, 0382253049, Hùng Sơn, Đại Từ, Thái Nguyên',
    items: [
      {
        id: '101',
        name: 'Áo Polo Nam Cotton Khử Mùi',
        price: 359000,
        originalPrice: 450000,
        image: 'https://media.coolmate.me/cdn-cgi/image/width=320,height=470,quality=85/uploads/February2025/11025595_24_copy_11.jpg',
        quantity: 1,
        color: 'Đen',
        size: 'L',
      },
      {
        id: '105',
        name: 'Quần Shorts Nam Thể Thao Co Giãn',
        price: 249000,
        originalPrice: 299000,
        image: 'https://media.coolmate.me/cdn-cgi/image/width=320,height=470,quality=85/uploads/November2024/24CMCW.AT012.2_72.jpg',
        quantity: 2,
        color: 'Đen',
        size: 'M',
      },
    ],
    statusSteps: [
      { label: 'Tiếp nhận', timestamp: '2026-03-10 10:35', description: 'Đơn hàng đã được tiếp nhận' },
      { label: 'Đang chuẩn bị hàng', timestamp: '2026-03-10 16:00', description: 'Kho đang đóng gói' },
      { label: 'Đang giao', timestamp: '2026-03-11 08:20', description: 'Đã bàn giao cho đơn vị vận chuyển' },
    ],
  },
  {
    id: 'DH123455',
    createdAt: '2026-02-28T09:10:00Z',
    status: 'delivered',
    total: 399000,
    paymentMethod: 'COD',
    addressSummary: 'Anh Thịnh, 0382253049, Hùng Sơn, Đại Từ, Thái Nguyên',
    items: [
      {
        id: '208',
        name: 'Áo Dây Cami Lụa Mát Mẻ',
        price: 159000,
        image: 'https://media.coolmate.me/cdn-cgi/image/width=320,height=470,quality=85/uploads/November2024/24CMCW.AT005.5_88.jpg',
        quantity: 1,
        color: 'Trắng',
        size: 'S',
      },
      {
        id: '201',
        name: 'Váy Liền Nữ Cổ Khuy Thanh Lịch',
        price: 240000,
        originalPrice: 499000,
        image: 'https://media.coolmate.me/cdn-cgi/image/width=320,height=470,quality=85/uploads/November2024/24CMCW.DK001.2_77.jpg',
        quantity: 1,
        color: 'Đen',
        size: 'M',
      },
    ],
    statusSteps: [
      { label: 'Tiếp nhận', timestamp: '2026-02-28 09:12' },
      { label: 'Đang chuẩn bị hàng', timestamp: '2026-02-28 12:00' },
      { label: 'Đang giao', timestamp: '2026-03-01 08:00' },
      { label: 'Giao thành công', timestamp: '2026-03-02 11:25' },
    ],
  },
];

const load = (): Order[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedOrders;
    const data: Order[] = JSON.parse(raw);
    return data.length ? data : seedOrders;
  } catch {
    return seedOrders;
  }
};

const save = (orders: Order[]) => {
  localStorage.setItem(KEY, JSON.stringify(orders));
};

export const orderService = {
  list(): Order[] {
    return load().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getById(id: string): Order | null {
    return load().find(o => o.id === id) || null;
  },

  add(order: Order) {
    const data = load();
    data.push(order);
    save(data);
  },

};
