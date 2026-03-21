import './Admin.css';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Eye, Ban, X, Mail, Download, Gift, ChevronDown, Sparkles, Link2, Trash2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock, AdminTableSkeleton } from './AdminStateBlocks';
import AdminConfirmDialog from './AdminConfirmDialog';
import AdminReasonDialog from './AdminReasonDialog';
import { useAdminListState } from './useAdminListState';
import { ADMIN_VIEW_KEYS } from './adminListView';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import { ADMIN_ACTION_TITLES, ADMIN_COMMON_LABELS } from './adminUiLabels';
import { customerOrderStatusLabel, customerOrderStatusTone } from './adminStatusMaps';
import { ADMIN_TOAST_MESSAGES } from './adminMessages';
import { ADMIN_TEXT } from './adminText';

type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
type AccountStatus = 'active' | 'banned';
type DrawerTab = 'activity' | 'preferences' | 'notes';

interface PendingLockAction {
  ids: string[];
  names: string[];
  isBulk: boolean;
  suggestedReason: string;
}

interface CustomerDeleteConfirmState {
  ids: string[];
  selectedItems?: string[];
}

interface CustomerOrder {
  code: string;
  date: string;
  total: number;
  status: 'pending' | 'shipping' | 'done' | 'canceled';
}

interface FavoriteCategory {
  name: string;
  purchases: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  tier: LoyaltyTier;
  totalOrders: number;
  totalSpent: number;
  status: AccountStatus;
  lastOrder: string;
  createdAt: string;
  address: string;
  dob: string;
  note: string;
  orderHistory: CustomerOrder[];
  favoriteCategories: FavoriteCategory[];
}

const initialCustomers: Customer[] = [
  {
    id: 'cus-001',
    name: 'Nguyễn Minh Anh',
    email: 'minhanh@gmail.com',
    phone: '0909 112 233',
    avatar: 'https://i.pravatar.cc/80?img=32',
    tier: 'Diamond',
    totalOrders: 42,
    totalSpent: 28650000,
    status: 'active',
    lastOrder: '2026-03-16T14:20:00',
    createdAt: '2024-08-11T09:00:00',
    address: '102 Nguyễn Huệ, Quận 1, TP.HCM',
    dob: '1996-04-12',
    note: 'Khách VIP, ưu tiên giao nhanh và hotline riêng.',
    orderHistory: [
      { code: 'ORD-30451', date: '2026-03-16T14:20:00', total: 1850000, status: 'done' },
      { code: 'ORD-30380', date: '2026-03-11T18:10:00', total: 1260000, status: 'done' },
      { code: 'ORD-30120', date: '2026-02-22T10:08:00', total: 920000, status: 'done' },
      { code: 'ORD-29801', date: '2026-02-01T19:12:00', total: 1450000, status: 'shipping' },
      { code: 'ORD-29400', date: '2026-01-14T09:20:00', total: 860000, status: 'done' },
    ],
    favoriteCategories: [
      { name: 'Áo Polo', purchases: 5 },
      { name: 'Quần Short', purchases: 3 },
      { name: 'Áo Thun Basic', purchases: 2 },
    ],
  },
  {
    id: 'cus-002',
    name: 'Lê Hoàng Đức',
    email: 'hoangduc@outlook.com',
    phone: '0933 881 776',
    tier: 'Gold',
    totalOrders: 18,
    totalSpent: 9340000,
    status: 'active',
    lastOrder: '2026-03-14T09:45:00',
    createdAt: '2025-11-05T08:10:00',
    address: '18 Lê Đại Hành, Hai Bà Trưng, Hà Nội',
    dob: '1998-09-03',
    note: 'Thường mua combo, phản hồi tích cực.',
    orderHistory: [
      { code: 'ORD-30312', date: '2026-03-14T09:45:00', total: 2140000, status: 'done' },
      { code: 'ORD-30199', date: '2026-03-05T16:22:00', total: 720000, status: 'done' },
      { code: 'ORD-30004', date: '2026-02-18T20:30:00', total: 760000, status: 'done' },
      { code: 'ORD-29751', date: '2026-01-30T11:09:00', total: 520000, status: 'done' },
      { code: 'ORD-29590', date: '2026-01-19T07:55:00', total: 610000, status: 'done' },
    ],
    favoriteCategories: [
      { name: 'Áo Khoác', purchases: 4 },
      { name: 'Áo Polo', purchases: 3 },
      { name: 'Phụ kiện', purchases: 2 },
    ],
  },
  {
    id: 'cus-003',
    name: 'Trần Bảo Ngọc',
    email: 'baongoc@yahoo.com',
    phone: '0988 331 447',
    avatar: 'https://i.pravatar.cc/80?img=44',
    tier: 'Silver',
    totalOrders: 7,
    totalSpent: 2450000,
    status: 'active',
    lastOrder: '2026-03-01T11:10:00',
    createdAt: '2026-03-01T09:50:00',
    address: '22 Trần Phú, Nha Trang, Khánh Hòa',
    dob: '2001-01-16',
    note: '',
    orderHistory: [
      { code: 'ORD-29641', date: '2026-03-01T11:10:00', total: 590000, status: 'done' },
      { code: 'ORD-29588', date: '2026-02-27T15:20:00', total: 460000, status: 'done' },
      { code: 'ORD-29512', date: '2026-02-20T13:30:00', total: 250000, status: 'done' },
      { code: 'ORD-29390', date: '2026-01-13T10:45:00', total: 420000, status: 'canceled' },
      { code: 'ORD-29301', date: '2026-01-08T08:01:00', total: 510000, status: 'done' },
    ],
    favoriteCategories: [
      { name: 'Áo Thun Basic', purchases: 4 },
      { name: 'Áo Polo', purchases: 2 },
      { name: 'Váy/Skirt', purchases: 1 },
    ],
  },
  {
    id: 'cus-004',
    name: 'Phạm Quỳnh Như',
    email: 'quynhnhu@icloud.com',
    phone: '0977 556 112',
    tier: 'Bronze',
    totalOrders: 2,
    totalSpent: 620000,
    status: 'banned',
    lastOrder: '2026-01-21T17:05:00',
    createdAt: '2026-01-08T13:20:00',
    address: '77 Hồ Tùng Mậu, Cầu Giấy, Hà Nội',
    dob: '2002-10-21',
    note: 'Tài khoản đã khóa do phát hiện đơn hàng ảo.',
    orderHistory: [
      { code: 'ORD-28019', date: '2026-01-21T17:05:00', total: 320000, status: 'canceled' },
      { code: 'ORD-27930', date: '2026-01-10T08:32:00', total: 300000, status: 'done' },
      { code: 'ORD-27880', date: '2025-12-30T16:50:00', total: 280000, status: 'canceled' },
      { code: 'ORD-27821', date: '2025-12-25T08:06:00', total: 340000, status: 'canceled' },
      { code: 'ORD-27790', date: '2025-12-20T14:00:00', total: 260000, status: 'done' },
    ],
    favoriteCategories: [
      { name: 'Quần Short', purchases: 1 },
      { name: 'Áo Polo', purchases: 1 },
    ],
  },
  {
    id: 'cus-005',
    name: 'Đoàn Tuấn Kiệt',
    email: 'tuankiet@gmail.com',
    phone: '0911 222 119',
    tier: 'Silver',
    totalOrders: 11,
    totalSpent: 4760000,
    status: 'active',
    lastOrder: '2026-03-12T16:55:00',
    createdAt: '2025-10-12T11:00:00',
    address: '5 Nguyễn Thái Học, Đà Nẵng',
    dob: '1997-07-09',
    note: 'Hay đổi size, cần note kỹ size chart trước khi chốt đơn.',
    orderHistory: [
      { code: 'ORD-30210', date: '2026-03-12T16:55:00', total: 870000, status: 'done' },
      { code: 'ORD-30080', date: '2026-02-26T09:14:00', total: 390000, status: 'shipping' },
      { code: 'ORD-29860', date: '2026-02-03T21:10:00', total: 560000, status: 'done' },
      { code: 'ORD-29722', date: '2026-01-28T10:05:00', total: 490000, status: 'done' },
      { code: 'ORD-29491', date: '2026-01-15T13:40:00', total: 620000, status: 'done' },
    ],
    favoriteCategories: [
      { name: 'Áo Polo', purchases: 5 },
      { name: 'Quần Jean', purchases: 2 },
      { name: 'Áo Thun Basic', purchases: 2 },
    ],
  },
];

const tabs = [
  { key: 'all', label: ADMIN_TEXT.customers.tabs.all },
  { key: 'new', label: ADMIN_TEXT.customers.tabs.new },
  { key: 'vip', label: ADMIN_TEXT.customers.tabs.vip },
  { key: 'banned', label: ADMIN_TEXT.customers.tabs.banned },
];

const validCustomerTabs = new Set(tabs.map((tab) => tab.key));

const tierToClass: Record<LoyaltyTier, string> = {
  Bronze: 'tier-bronze',
  Silver: 'tier-silver',
  Gold: 'tier-gold',
  Diamond: 'tier-diamond',
};

const moneyFormatter = new Intl.NumberFormat('vi-VN');
const formatCurrencyVnd = (value: number) => `${moneyFormatter.format(value)} đ`;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const spendingInRange = (totalSpent: number, range: string) => {
  if (range === 'all') return true;
  if (range === 'under1m') return totalSpent < 1000000;
  if (range === '1m-5m') return totalSpent >= 1000000 && totalSpent < 5000000;
  if (range === '5m-10m') return totalSpent >= 5000000 && totalSpent < 10000000;
  if (range === '10m+') return totalSpent >= 10000000;
  return true;
};

const isNewCustomer = (createdAt: string) => {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) <= 30;
};

const isVipCustomer = (c: Customer) => c.tier === 'Gold' || c.tier === 'Diamond' || c.totalSpent >= 5000000;

const AdminCustomers = () => {
  const t = ADMIN_TEXT.customers;
  const c = ADMIN_TEXT.common;
  const tf = t.filters;
  
  const tierOptions = useMemo(() => [
    { value: 'all', label: tf.tierAll },
    { value: 'Bronze', label: 'Bronze' },
    { value: 'Silver', label: 'Silver' },
    { value: 'Gold', label: 'Gold' },
    { value: 'Diamond', label: 'Diamond' },
  ], [tf.tierAll]);

  const spendingOptions = useMemo(() => [
    { value: 'all', label: tf.spendAll },
    { value: 'under1m', label: tf.spendUnder1m },
    { value: '1m-5m', label: tf.spend1m5m },
    { value: '5m-10m', label: tf.spend5m10m },
    { value: '10m+', label: tf.spend10mPlus },
  ], [tf.spendAll, tf.spendUnder1m, tf.spend1m5m, tf.spend5m10m, tf.spend10mPlus]);

  const validTierFilters = useMemo(() => new Set(tierOptions.map((option) => option.value)), [tierOptions]);
  const validSpendingFilters = useMemo(() => new Set(spendingOptions.map((option) => option.value)), [spendingOptions]);
  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.customers,
    path: '/admin/customers',
    validStatusKeys: tabs.map((tab) => tab.key),
    defaultStatus: 'all',
    statusAliases: ['tab'],
    extraFilters: [
      { key: 'tier', defaultValue: 'all', validate: (value) => validTierFilters.has(value) },
      { key: 'spend', defaultValue: 'all', validate: (value) => validSpendingFilters.has(value) },
    ],
  });
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const activeTab = validCustomerTabs.has(view.status) ? view.status : 'all';
  const tierFilter = validTierFilters.has(view.extras.tier || 'all') ? (view.extras.tier as 'all' | LoyaltyTier) : 'all';
  const spendingFilter = validSpendingFilters.has(view.extras.spend || 'all') ? (view.extras.spend as string) : 'all';
  const [openFilter, setOpenFilter] = useState<'tier' | 'spending' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('activity');
  const [draftNote, setDraftNote] = useState('');
  const [pendingLockAction, setPendingLockAction] = useState<PendingLockAction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CustomerDeleteConfirmState | null>(null);
  const { toast, pushToast } = useAdminToast(2300);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);

  const handleFilterKeyDown = useCallback((e: React.KeyboardEvent, filterType: 'tier' | 'spending') => {
    const options = filterType === 'tier' ? tierOptions : spendingOptions;
    const currentFilter = filterType === 'tier' ? tierFilter : spendingFilter;
    const currentIndex = options.findIndex(o => o.value === currentFilter);

    const applyFilter = (value: string) => {
      setSelected(new Set());
      setOpenFilter(null);
      view.setExtra(filterType, value);
    };

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        applyFilter(options[nextIndex].value);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        applyFilter(options[prevIndex].value);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setOpenFilter(openFilter === filterType ? null : filterType);
        break;
      case 'Escape':
        e.preventDefault();
        setOpenFilter(null);
        break;
    }
  }, [tierOptions, spendingOptions, tierFilter, spendingFilter, openFilter, view]);

  const {
    search,
    isLoading,
    filteredItems: filtered,
    page,
    totalPages,
    startIndex,
    endIndex,
    pagedItems: pagedCustomers,
    next,
    prev,
    setPage,
  } = useAdminListState<Customer>({
    items: customers,
    pageSize: 8,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    getSearchText: (c) => `${c.name} ${c.email} ${c.phone}`,
    filterPredicate: (c) => {
      if (activeTab === 'new' && !isNewCustomer(c.createdAt)) return false;
      if (activeTab === 'vip' && !isVipCustomer(c)) return false;
      if (activeTab === 'banned' && c.status !== 'banned') return false;
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (!spendingInRange(c.totalSpent, spendingFilter)) return false;
      return true;
    },
    loadingDeps: [activeTab, tierFilter, spendingFilter],
  });

  const activeCustomer = useMemo(() => customers.find((c) => c.id === drawerCustomerId) ?? null, [customers, drawerCustomerId]);
  const tierFilterLabel = tierOptions.find((o) => o.value === tierFilter)?.label ?? 'Tất cả hạng';
  const spendingFilterLabel = spendingOptions.find((o) => o.value === spendingFilter)?.label ?? 'Tất cả chi tiêu';

  useEffect(() => {
    setSelected(new Set());
    setDeleteConfirm(null);
  }, [activeTab, tierFilter, spendingFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openFilter) return;
      if (!filterDropdownRef.current) return;
      if (!filterDropdownRef.current.contains(event.target as Node)) {
        setOpenFilter(null);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openFilter) setOpenFilter(null);
      else if (drawerCustomerId) closeDrawer();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [openFilter, drawerCustomerId]);

  const handleSearchChange = (value: string) => {
    view.setSearch(value);
  };

  const changeTab = (nextTab: string) => {
    setSelected(new Set());
    view.setStatus(nextTab);
  };

  const changeTierFilter = (nextTier: 'all' | LoyaltyTier) => {
    setSelected(new Set());
    setOpenFilter(null);
    view.setExtra('tier', nextTier);
  };

  const changeSpendingFilter = (nextSpend: string) => {
    setSelected(new Set());
    setOpenFilter(null);
    view.setExtra('spend', nextSpend);
  };

  const shareCurrentView = async () => {
    try {
      await view.shareCurrentView();
      pushToast(ADMIN_TOAST_MESSAGES.viewCopied);
    } catch {
      pushToast(ADMIN_TOAST_MESSAGES.copyFailed);
    }
  };

  const resetCurrentView = () => {
    setSelected(new Set());
    setOpenFilter(null);
    setPendingLockAction(null);
    setDeleteConfirm(null);
    view.resetCurrentView();
    pushToast(ADMIN_TOAST_MESSAGES.customers.resetView);
  };

  const toggleSelectAll = (checked: boolean) => setSelected(checked ? new Set(filtered.map((c) => c.id)) : new Set());

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const openDrawer = (customer: Customer, tab: DrawerTab = 'activity') => {
    setDrawerCustomerId(customer.id);
    setDrawerTab(tab);
    setDraftNote(customer.note ?? '');
  };

  const closeDrawer = () => {
    setDrawerCustomerId(null);
    setDraftNote('');
  };

  const toggleBanStatus = (customerId: string) => {
    const user = customers.find((c) => c.id === customerId);
    if (!user) return;
    if (user.status === 'active') {
      setPendingLockAction({
        ids: [customerId],
        names: [user.name],
        isBulk: false,
        suggestedReason: 'Vi phạm chính sách mua hàng',
      });
      return;
    }

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, status: 'active' } : c)));
    pushToast(ADMIN_TOAST_MESSAGES.customers.unlockedAccount(user.name));
  };

  const saveAdminNote = () => {
    if (!activeCustomer) return;
    setCustomers((prev) => prev.map((c) => (c.id === activeCustomer.id ? { ...c, note: draftNote.trim() } : c)));
    pushToast(ADMIN_TOAST_MESSAGES.customers.noteSaved);
  };

  const selectedIds = Array.from(selected);
  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label || t.tabs.all;
  const hasViewContext = activeTab !== 'all' || tierFilter !== 'all' || spendingFilter !== 'all' || Boolean(search.trim()) || view.page > 1;
  const tabCounts = {
    all: customers.length,
    new: customers.filter((customer) => isNewCustomer(customer.createdAt)).length,
    vip: customers.filter((customer) => isVipCustomer(customer)).length,
    banned: customers.filter((customer) => customer.status === 'banned').length,
  } as const;

  const handleBulkSendVoucher = () => {
    if (!selectedIds.length) return;
    pushToast(ADMIN_TOAST_MESSAGES.customers.vouchersSent(selectedIds.length));
  };

  const handleBulkBan = () => {
    if (!selectedIds.length) return;
    const targetIds = new Set(customers.filter((c) => selected.has(c.id) && c.status !== 'banned').map((c) => c.id));
    if (targetIds.size === 0) {
      pushToast(ADMIN_TOAST_MESSAGES.customers.alreadyBanned);
      return;
    }
    const names = customers.filter((c) => targetIds.has(c.id)).map((c) => c.name);
    setPendingLockAction({
      ids: Array.from(targetIds),
      names,
      isBulk: true,
      suggestedReason: 'Nghi ngờ gian lận/hoàn trả bất thường',
    });
  };

  const confirmLockCustomers = (reason: string) => {
    if (!pendingLockAction) return;
    if (!reason.trim()) {
      pushToast(ADMIN_TOAST_MESSAGES.customers.lockReasonRequired);
      return;
    }
    const targetIds = new Set(pendingLockAction.ids);
    setCustomers((prev) => prev.map((c) => (targetIds.has(c.id) ? { ...c, status: 'banned' } : c)));
    if (pendingLockAction.isBulk) {
      pushToast(ADMIN_TOAST_MESSAGES.customers.bulkLocked(targetIds.size));
      setSelected(new Set());
    } else {
      pushToast(ADMIN_TOAST_MESSAGES.customers.lockedAccount(pendingLockAction.names[0] || 'khách hàng'));
    }
    setPendingLockAction(null);
  };

  const requestDeleteCustomer = (customer: Customer) => {
    setDeleteConfirm({
      ids: [customer.id],
    });
  };

  const confirmDeleteCustomers = () => {
    if (!deleteConfirm || deleteConfirm.ids.length === 0) {
      setDeleteConfirm(null);
      return;
    }
    const idsToDelete = new Set(deleteConfirm.ids);
    setCustomers((prev) => prev.filter((item) => !idsToDelete.has(item.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      return next;
    });
    setDeleteConfirm(null);
    pushToast(ADMIN_TOAST_MESSAGES.customers.deleted(idsToDelete.size));
  };

  const handleBulkSendEmail = () => {
    if (!selectedIds.length) return;
    pushToast(ADMIN_TOAST_MESSAGES.customers.emailsSent(selectedIds.length));
  };

  const handleExport = () => {
    pushToast(ADMIN_TOAST_MESSAGES.customers.exportRequested(filtered.length));
  };

  return (
    <AdminLayout
      title={t.title}
      actions={
        <div className="customer-actions" ref={filterDropdownRef}>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} value={search} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          <button className="admin-ghost-btn" onClick={shareCurrentView}><Link2 size={16} /> {ADMIN_COMMON_LABELS.shareView}</button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>{ADMIN_COMMON_LABELS.resetView}</button>

          <button className="admin-icon-btn subtle" onClick={handleExport} title={ADMIN_ACTION_TITLES.exportCustomerData} aria-label={ADMIN_ACTION_TITLES.exportCustomerData}>
            <Download size={16} />
          </button>

          <div className="admin-filter-dropdown-wrap">
            <button 
              className="admin-filter-trigger" 
              onClick={() => setOpenFilter((p) => (p === 'tier' ? null : 'tier'))}
              onKeyDown={(e) => handleFilterKeyDown(e, 'tier')}
              aria-haspopup="listbox"
              aria-expanded={openFilter === 'tier'}
            >
              <Sparkles size={15} />
              <span>{tierFilterLabel}</span>
              <ChevronDown size={14} className={openFilter === 'tier' ? 'rotate' : ''} />
            </button>
            <AnimatePresence>
              {openFilter === 'tier' && (
                <motion.div 
                  className="admin-filter-menu" 
                  role="listbox"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: 8, scale: 0.98 }} 
                  transition={{ duration: 0.18 }}
                >
                  {tierOptions.map((option) => (
                    <button 
                      key={option.value} 
                      className={`admin-filter-item ${tierFilter === option.value ? 'active' : ''}`} 
                      onClick={() => changeTierFilter(option.value as 'all' | LoyaltyTier)}
                      role="option"
                      aria-selected={tierFilter === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="admin-filter-dropdown-wrap">
            <button 
              className="admin-filter-trigger" 
              onClick={() => setOpenFilter((p) => (p === 'spending' ? null : 'spending'))}
              onKeyDown={(e) => handleFilterKeyDown(e, 'spending')}
              aria-haspopup="listbox"
              aria-expanded={openFilter === 'spending'}
            >
              <Sparkles size={15} />
              <span>{spendingFilterLabel}</span>
              <ChevronDown size={14} className={openFilter === 'spending' ? 'rotate' : ''} />
            </button>
            <AnimatePresence>
              {openFilter === 'spending' && (
                <motion.div 
                  className="admin-filter-menu" 
                  role="listbox"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: 8, scale: 0.98 }} 
                  transition={{ duration: 0.18 }}
                >
                  {spendingOptions.map((option) => (
                    <button 
                      key={option.value} 
                      className={`admin-filter-item ${spendingFilter === option.value ? 'active' : ''}`} 
                      onClick={() => changeSpendingFilter(option.value)}
                      role="option"
                      aria-selected={spendingFilter === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="customer-result-chip">{t.resultLabel(filtered.length)}</div>
        </div>
      }
    >
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => changeTab(tab.key)}>
            <span>{tab.label}</span>
            <span className="admin-tab-count">{tabCounts[tab.key as keyof typeof tabCounts]}</span>
          </button>
        ))}
      </div>

      {hasViewContext && (
        <div className="admin-view-summary">
          <span className="summary-chip">{t.summary.group}: {activeTabLabel}</span>
          {search.trim() && <span className="summary-chip">{c.keyword}: {search.trim()}</span>}
          {tierFilter !== 'all' && <span className="summary-chip">{t.summary.tier}: {tierFilterLabel}</span>}
          {spendingFilter !== 'all' && <span className="summary-chip">{t.summary.spend}: {spendingFilterLabel}</span>}
          <button className="summary-clear" onClick={resetCurrentView}>{c.clearFilters}</button>
        </div>
      )}

      <section className="admin-panels single">
        <div className="admin-panel">
          {isLoading ? (
            <AdminTableSkeleton columns={9} rows={7} />
          ) : filtered.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? t.empty.searchTitle : t.empty.defaultTitle}
                description={search.trim() ? t.empty.searchDescription : t.empty.defaultDescription}
                actionLabel={ADMIN_COMMON_LABELS.resetFilters}
                onAction={resetCurrentView}
              />
          ) : (
          <div className="admin-table" role="table" aria-label={t.tableAria}>
            <div className="admin-table-row admin-table-head customers" role="row">
              <div role="columnheader"><input type="checkbox" aria-label="Chọn tất cả" checked={selected.size === filtered.length && filtered.length > 0} onChange={(e) => toggleSelectAll(e.target.checked)} /></div>
              <div role="columnheader">{t.columns.customer}</div>
              <div role="columnheader">{t.columns.phone}</div>
              <div role="columnheader">{t.columns.tier}</div>
              <div role="columnheader">{t.columns.totalOrders}</div>
              <div role="columnheader">{t.columns.totalSpent}</div>
              <div role="columnheader">{t.columns.status}</div>
              <div role="columnheader">{t.columns.lastOrder}</div>
              <div role="columnheader" style={{ textAlign: 'right', paddingRight: '12px' }}>{t.columns.actions}</div>
            </div>

            {pagedCustomers.map((customer, idx) => (
              <motion.div
                key={customer.id}
                className="admin-table-row customers customer-row"
                role="row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.18) }}
                whileHover={{ y: -1 }}
              >
                <div role="cell"><input type="checkbox" aria-label={`Chọn ${customer.name}`} checked={selected.has(customer.id)} onChange={(e) => toggleOne(customer.id, e.target.checked)} /></div>
                <div role="cell" className="customer-info-cell">
                  {customer.avatar ? <img src={customer.avatar} alt={customer.name} className="customer-avatar" /> : <div className="customer-avatar initials">{getInitials(customer.name)}</div>}
                  <div className="customer-text">
                    <p className="admin-bold customer-name">{customer.name}</p>
                    <p className="admin-muted customer-email">{customer.email}</p>
                  </div>
                </div>
                <div role="cell" className="customer-phone">{customer.phone}</div>
                <div role="cell"><span className={`admin-pill ${tierToClass[customer.tier]}`}>{customer.tier}</span></div>
                <div role="cell" className="admin-bold customer-orders-count">{customer.totalOrders}</div>
                <div role="cell" className="admin-bold customer-spent">{formatCurrencyVnd(customer.totalSpent)}</div>
                <div role="cell" className="customer-status-cell"><span className={`admin-pill ${customer.status === 'active' ? 'success' : 'error'}`}>{customer.status === 'active' ? t.drawer.status.active : t.drawer.status.banned}</span></div>
                <div role="cell" className="admin-muted customer-last-order">{formatDate(customer.lastOrder)}</div>
                <div role="cell" className="admin-actions">
                  <button className="admin-icon-btn subtle" title={ADMIN_ACTION_TITLES.viewDetail} aria-label={ADMIN_ACTION_TITLES.viewDetail} onClick={() => openDrawer(customer, 'activity')}><Eye size={16} /></button>
                  <button className="admin-icon-btn subtle" title={customer.status === 'active' ? ADMIN_ACTION_TITLES.lockAccount : ADMIN_ACTION_TITLES.unlockAccount} aria-label={customer.status === 'active' ? ADMIN_ACTION_TITLES.lockAccount : ADMIN_ACTION_TITLES.unlockAccount} onClick={() => toggleBanStatus(customer.id)}><Ban size={16} /></button>
                  <button className="admin-icon-btn subtle danger-icon" title={ADMIN_ACTION_TITLES.delete} aria-label={ADMIN_ACTION_TITLES.delete} onClick={() => requestDeleteCustomer(customer)}><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))}
          </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="table-footer">
              <span className="table-footer-meta">{c.showing(startIndex, endIndex, filtered.length, t.selectedNoun)}</span>
              <div className="pagination">
                <button className="page-btn" onClick={prev} disabled={page === 1}>{c.previous}</button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button key={idx + 1} className={`page-btn ${page === idx + 1 ? 'active' : ''}`} onClick={() => setPage(idx + 1)}>
                    {idx + 1}
                  </button>
                ))}
                <button className="page-btn" onClick={next} disabled={page === totalPages}>{c.next}</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div className="customer-floating-bar" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 22 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <div className="customer-floating-content">
              <span>{c.selected(selected.size, t.selectedNoun)}</span>
              <div className="admin-actions">
                <button className="admin-ghost-btn" onClick={handleBulkSendVoucher}><Gift size={15} /> {t.floatingActions.sendVoucher}</button>
                <button className="admin-ghost-btn danger" onClick={handleBulkBan}><Ban size={15} /> {t.floatingActions.lockAccount}</button>
                <button className="admin-primary-btn" onClick={handleBulkSendEmail}><Mail size={15} /> {t.floatingActions.sendEmail}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerCustomerId && activeCustomer && (
          <>
            <motion.div className="drawer-overlay" onClick={closeDrawer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            <motion.div className="drawer customer-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              <div className="drawer-header">
                <div>
                  <p className="drawer-eyebrow">{t.drawer.title}</p>
                  <h3>{activeCustomer.name}</h3>
                </div>
                <button className="admin-icon-btn" onClick={closeDrawer} aria-label={ADMIN_ACTION_TITLES.close}><X size={16} /></button>
              </div>

              <div className="drawer-body customer-drawer-body">
                <section className="drawer-section">
                  <div className="customer-drawer-hero">
                    {activeCustomer.avatar ? <img src={activeCustomer.avatar} alt={activeCustomer.name} className="customer-avatar" /> : <div className="customer-avatar initials">{getInitials(activeCustomer.name)}</div>}
                    <div>
                      <p className="admin-bold">{activeCustomer.name}</p>
                      <p className="admin-muted small">{activeCustomer.email}</p>
                    </div>
                    <span className={`admin-pill ${tierToClass[activeCustomer.tier]}`}>{activeCustomer.tier}</span>
                  </div>
                  <div className="customer-profile-grid">
                    <div><p className="admin-muted small">Email</p><p className="admin-bold">{activeCustomer.email}</p></div>
                    <div><p className="admin-muted small">Số điện thoại</p><p className="admin-bold">{activeCustomer.phone}</p></div>
                    <div><p className="admin-muted small">Ngày sinh</p><p className="admin-bold">{formatDate(activeCustomer.dob)}</p></div>
                    <div><p className="admin-muted small">Địa chỉ</p><p className="admin-bold">{activeCustomer.address}</p></div>
                  </div>
                </section>

                <section className="drawer-section">
                  <div className="customer-drawer-tabs">
                    <button className={drawerTab === 'activity' ? 'active' : ''} onClick={() => setDrawerTab('activity')}>{t.drawer.tabs.activity}</button>
                    <button className={drawerTab === 'preferences' ? 'active' : ''} onClick={() => setDrawerTab('preferences')}>{t.drawer.tabs.preferences}</button>
                    <button className={drawerTab === 'notes' ? 'active' : ''} onClick={() => setDrawerTab('notes')}>{t.drawer.tabs.notes}</button>
                  </div>

                  <AnimatePresence mode="wait">
                    {drawerTab === 'activity' && (
                      <motion.div key="activity" className="customer-tab-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                        <ul className="customer-timeline">
                          {activeCustomer.orderHistory.slice(0, 5).map((order) => (
                            <li key={order.code} className="customer-timeline-item">
                              <span className={`customer-timeline-dot ${customerOrderStatusTone(order.status)}`} />
                              <div>
                                <p className="admin-bold">{order.code} · {formatCurrencyVnd(order.total)}</p>
                                <p className="admin-muted small">{formatDateTime(order.date)} · {customerOrderStatusLabel(order.status)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}

                    {drawerTab === 'preferences' && (
                      <motion.div key="preferences" className="customer-tab-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                        <ul className="customer-pref-list">
                          {activeCustomer.favoriteCategories.map((item) => (
                            <li key={item.name}>
                              <div className="customer-pref-label"><span>{item.name}</span><strong>{item.purchases} lần</strong></div>
                              <div className="customer-pref-bar"><span style={{ width: `${Math.min(100, item.purchases * 18)}%` }} /></div>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}

                    {drawerTab === 'notes' && (
                      <motion.div key="notes" className="customer-tab-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                        <label className="form-field">
                          <span>Ghi chú nội bộ chỉ dành cho Admin</span>
                          <textarea rows={5} value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder={t.drawer.notePlaceholder} />
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>

              <div className="drawer-footer">
                <button className="admin-ghost-btn" onClick={closeDrawer}>{t.drawer.close}</button>
                <button className="admin-primary-btn" onClick={saveAdminNote}>{t.drawer.saveNote}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AdminConfirmDialog
        open={Boolean(deleteConfirm)}
        title="Xóa khách hàng"
        description="Bạn có chắc chắn muốn xóa khách hàng đã chọn? Hành động này không thể hoàn tác."
        selectedItems={deleteConfirm?.selectedItems}
        selectedNoun={t.selectedNoun}
        confirmLabel="Xóa khách hàng"
        danger
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteCustomers}
      />

      <AdminReasonDialog
        open={Boolean(pendingLockAction)}
        title={pendingLockAction?.isBulk ? t.drawer.lockTitleBulk : t.drawer.lockTitle}
        description="Vui lòng nhập lý do trước khi khóa tài khoản khách hàng."
        fieldLabel="Lý do khóa"
        placeholder="Nhập lý do khóa tài khoản..."
        defaultValue={pendingLockAction?.suggestedReason || ''}
        selectedItems={pendingLockAction?.names}
        selectedNoun="tài khoản"
        confirmLabel="Xác nhận khóa"
        danger
        onCancel={() => setPendingLockAction(null)}
        onConfirm={confirmLockCustomers}
      />

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminCustomers;
