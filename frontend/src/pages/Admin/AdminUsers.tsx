import './AdminUsers.css';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Ban, CheckCircle2, Eye, Link2, Search, Shield, ShieldCheck, UserRound, X } from 'lucide-react';
import AdminLayout from './AdminLayout';
import AdminConfirmDialog from './AdminConfirmDialog';
import { AdminStateBlock } from './AdminStateBlocks';
import { PanelStatsGrid, PanelTabs } from '../../components/Panel/PanelPrimitives';
import { useToast } from '../../contexts/ToastContext';
import { adminUserService, type AdminUserRecord, type AdminUserRole, type AdminUserStatus } from '../../services/adminUserService';
import { getUiErrorMessage } from '../../utils/errorMessage';
import Drawer from '../../components/Drawer/Drawer';

type UserFilter = 'all' | 'customer' | 'vendor' | 'admin' | 'locked';
type UserRole = AdminUserRole;
type UserStatus = AdminUserStatus;
type UserRecord = AdminUserRecord & { note?: string };

type ConfirmState = {
  mode: 'lock' | 'unlock';
  ids: string[];
  selectedItems: string[];
};

const USER_TABS: Array<{ key: UserFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'vendor', label: 'Người bán' },
  { key: 'admin', label: 'Quản trị viên' },
  { key: 'locked', label: 'Đã khóa' },
];

const roleLabel = (role: UserRole) => {
  if (role === 'CUSTOMER') return 'Khách hàng';
  if (role === 'VENDOR') return 'Người bán';
  return 'Quản trị viên';
};

const genderLabel = (gender?: UserRecord['gender']) => {
  if (gender === 'MALE') return 'Nam';
  if (gender === 'FEMALE') return 'Nữ';
  if (gender === 'OTHER') return 'Khác';
  return 'Chưa cập nhật';
};

const formatDob = (dateOfBirth?: string) => {
  if (!dateOfBirth) return 'Chưa cập nhật';
  const parsed = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Chưa cập nhật';
  return parsed.toLocaleDateString('vi-VN');
};

const statusLabel = (status: UserStatus) => {
  if (status === 'ACTIVE') return 'Đang hoạt động';
  if (status === 'LOCKED') return 'Đã khóa';
  return 'Chờ duyệt người bán';
};

const statusTone = (status: UserStatus) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'LOCKED') return 'error';
  return 'pending';
};

const roleTone = (role: UserRole) => {
  if (role === 'CUSTOMER') return 'neutral';
  if (role === 'VENDOR') return 'info';
  return 'warning';
};

const canManageUser = (user: UserRecord) => user.role !== 'SUPER_ADMIN';

const buildUserNote = (user: AdminUserRecord): string => {
  if (user.role === 'SUPER_ADMIN') return 'Tài khoản quản trị hệ thống';
  if (user.status === 'PENDING_VENDOR') return 'Đang chờ duyệt vendor onboarding';
  if (user.role === 'VENDOR') return 'Tài khoản vận hành gian hàng';
  return 'Tài khoản khách hàng';
};

const AdminUsers = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<UserFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<UserRecord | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await adminUserService.list();
        if (!mounted) return;
        setUsers((Array.isArray(data) ? data : []).map((user) => ({ ...user, note: buildUserNote(user) })));
      } catch (error: unknown) {
        if (!mounted) return;
        setUsers([]);
        setLoadError(getUiErrorMessage(error, 'Không tải được danh sách người dùng từ backend.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadUsers();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const filteredUsers = useMemo(() => {
    let next = users;

    if (activeTab !== 'all') {
      next = next.filter((user) => {
        if (activeTab === 'customer') return user.role === 'CUSTOMER';
        if (activeTab === 'vendor') return user.role === 'VENDOR' || user.status === 'PENDING_VENDOR';
        if (activeTab === 'admin') return user.role === 'SUPER_ADMIN';
        return user.status === 'LOCKED';
      });
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      next = next.filter((user) =>
        `${user.name} ${user.email} ${user.phone || ''} ${user.storeName || ''}`.toLowerCase().includes(query),
      );
    }

    return next;
  }, [activeTab, search, users]);

  const counts = useMemo(() => ({
    all: users.length,
    customer: users.filter((user) => user.role === 'CUSTOMER').length,
    vendor: users.filter((user) => user.role === 'VENDOR' || user.status === 'PENDING_VENDOR').length,
    admin: users.filter((user) => user.role === 'SUPER_ADMIN').length,
    locked: users.filter((user) => user.status === 'LOCKED').length,
  }), [users]);

  const totalPages = Math.max(Math.ceil(filteredUsers.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safePage]);

  const resetCurrentView = () => {
    setSearch('');
    setActiveTab('all');
    setSelected(new Set());
    setPage(1);
  };

  const shareCurrentView = async () => {
    await navigator.clipboard.writeText(window.location.href);
    addToast('Đã sao chép bộ lọc hiện tại của người dùng', 'success');
  };

  const openConfirm = (mode: 'lock' | 'unlock', ids: string[]) => {
    const items = users.filter((user) => ids.includes(user.id));
    if (items.length === 0) return;
    setConfirmState({
      mode,
      ids: items.map((item) => item.id),
      selectedItems: items.map((item) => item.name),
    });
  };

  const lockableSelectedIds = useMemo(
    () => Array.from(selected).filter((id) => {
      const user = users.find((item) => item.id === id);
      return Boolean(user && canManageUser(user) && user.status !== 'LOCKED');
    }),
    [selected, users],
  );

  const unlockableSelectedIds = useMemo(
    () => Array.from(selected).filter((id) => {
      const user = users.find((item) => item.id === id);
      return Boolean(user && canManageUser(user) && user.status === 'LOCKED');
    }),
    [selected, users],
  );

  const applyStatusChange = async () => {
    if (!confirmState) return;

    setActionLoading(true);
    try {
      const shouldBeActive = confirmState.mode === 'unlock';
      const updated = await Promise.all(
        confirmState.ids.map((id) => adminUserService.updateActive(id, shouldBeActive)),
      );
      const updatedMap = new Map(updated.map((item) => [item.id, { ...item, note: buildUserNote(item) }]));

      setUsers((prev) => prev.map((row) => updatedMap.get(row.id) || row));
      if (detailUser && updatedMap.has(detailUser.id)) {
        setDetailUser(updatedMap.get(detailUser.id) || null);
      }
      setSelected(new Set());
      setConfirmState(null);
      addToast(
        confirmState.mode === 'lock' ? 'Đã khóa tài khoản đã chọn' : 'Đã mở khóa tài khoản đã chọn',
        'success',
      );
    } catch (error: unknown) {
      addToast(getUiErrorMessage(error, 'Không thể cập nhật trạng thái tài khoản.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Người dùng"
      breadcrumbs={['Người dùng', 'Khách hàng và người bán']}
      actions={(
        <>
          <div className="admin-search">
            <Search size={16} />
            <input
              placeholder="Tìm theo tên, email, số điện thoại hoặc tên gian hàng"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <button className="admin-ghost-btn" onClick={() => void shareCurrentView()}>
            <Link2 size={16} />
            Chia sẻ bộ lọc
          </button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>Đặt lại</button>
        </>
      )}
    >
      <PanelStatsGrid
        items={[
          { key: 'all', label: 'Tổng tài khoản', value: counts.all, sub: 'Toàn bộ tài khoản đang theo dõi' },
          { key: 'customer', label: 'Khách hàng', value: counts.customer, sub: 'Tài khoản mua hàng trên sàn', tone: 'info', onClick: () => setActiveTab('customer') },
          { key: 'vendor', label: 'Người bán', value: counts.vendor, sub: 'Bao gồm vendor đang bán và đang chờ duyệt', tone: 'success', onClick: () => setActiveTab('vendor') },
          { key: 'locked', label: 'Đã khóa', value: counts.locked, sub: 'Tài khoản đang bị chặn đăng nhập', tone: counts.locked > 0 ? 'danger' : '', onClick: () => setActiveTab('locked') },
        ]}
      />

      <PanelTabs
        items={USER_TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: counts[tab.key],
        }))}
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as UserFilter);
          setSelected(new Set());
          setPage(1);
        }}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Danh sách người dùng</h2>
            {selected.size > 0 && (
              <div className="admin-actions">
                <span className="admin-muted">Đã chọn {selected.size} tài khoản</span>
                {lockableSelectedIds.length > 0 && (
                  <button className="admin-ghost-btn danger" onClick={() => openConfirm('lock', lockableSelectedIds)}>
                    Khóa đã chọn
                  </button>
                )}
                {unlockableSelectedIds.length > 0 && (
                  <button className="admin-ghost-btn" onClick={() => openConfirm('unlock', unlockableSelectedIds)}>
                    Mở khóa đã chọn
                  </button>
                )}
                <button className="admin-ghost-btn" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
              </div>
            )}
          </div>

          {loading ? (
            <AdminStateBlock
              type="empty"
              title="Đang tải danh sách người dùng"
              description="Hệ thống đang đồng bộ dữ liệu từ backend."
            />
          ) : loadError ? (
            <AdminStateBlock
              type="empty"
              title="Không tải được dữ liệu người dùng"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => setReloadKey((key) => key + 1)}
            />
          ) : filteredUsers.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có dữ liệu người dùng'}
              description={
                search.trim()
                  ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc để xem lại danh sách người dùng.'
                  : 'Danh sách tài khoản khách hàng, người bán và quản trị sẽ xuất hiện tại đây để operator theo dõi.'
              }
              actionLabel="Đặt lại bộ lọc"
              onAction={resetCurrentView}
            />
          ) : (
            <>
              <div className="admin-table" role="table" aria-label="Bảng người dùng hệ sinh thái">
                <div className="admin-table-row users admin-table-head" role="row">
                  <div role="columnheader">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={(event) => setSelected(event.target.checked ? new Set(filteredUsers.map((item) => item.id)) : new Set())}
                    />
                  </div>
                  <div role="columnheader">Tài khoản</div>
                  <div role="columnheader">Vai trò</div>
                  <div role="columnheader">Phạm vi</div>
                  <div role="columnheader">Ngày tham gia</div>
                  <div role="columnheader">Trạng thái</div>
                  <div role="columnheader">Hành động</div>
                </div>

                {pagedUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    className="admin-table-row users"
                    role="row"
                    whileHover={{ y: -1 }}
                    onClick={() => setDetailUser(user)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div role="cell" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(user.id);
                          else next.delete(user.id);
                          setSelected(next);
                        }}
                      />
                    </div>
                    <div role="cell" className="user-cell">
                      <div className="user-avatar">
                        <span>{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="user-copy">
                        <div className="admin-bold">{user.name || 'Chưa cập nhật tên'}</div>
                        <div className="admin-muted small">{user.email}</div>
                        <div className="admin-muted small">{user.phone || 'Chưa có số điện thoại'}</div>
                        <div className="admin-muted small">{genderLabel(user.gender)} • {formatDob(user.dateOfBirth)}</div>
                      </div>
                    </div>
                    <div role="cell">
                      <span className={`admin-pill ${roleTone(user.role)}`}>{roleLabel(user.role)}</span>
                    </div>
                    <div role="cell">
                      <div className="admin-bold">
                        {user.storeName || (user.role === 'SUPER_ADMIN' ? 'Toàn bộ marketplace' : 'Tài khoản người dùng')}
                      </div>
                      <div className="admin-muted small">
                        {user.status === 'PENDING_VENDOR'
                          ? 'Đang chờ duyệt onboarding'
                          : user.role === 'VENDOR'
                            ? 'Đã gắn quyền người bán'
                            : user.role === 'SUPER_ADMIN'
                              ? 'Toàn quyền quản trị'
                              : 'Phạm vi mua hàng'}
                      </div>
                    </div>
                    <div role="cell">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</div>
                    <div role="cell">
                      <span className={`admin-pill ${statusTone(user.status)}`}>{statusLabel(user.status)}</span>
                    </div>
                    <div role="cell" className="admin-actions" onClick={(event) => event.stopPropagation()}>
                      <button
                        className="admin-icon-btn subtle"
                        title="Xem hồ sơ"
                        aria-label="Xem hồ sơ"
                        onClick={() => setDetailUser(user)}
                      >
                        <Eye size={16} />
                      </button>
                      {canManageUser(user)
                        ? (user.status === 'LOCKED' ? (
                            <button
                              className="admin-icon-btn subtle"
                              title="Mở khóa tài khoản"
                              aria-label="Mở khóa tài khoản"
                              onClick={() => openConfirm('unlock', [user.id])}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          ) : (
                            <button
                              className="admin-icon-btn subtle danger-icon"
                              title="Khóa tài khoản"
                              aria-label="Khóa tài khoản"
                              onClick={() => openConfirm('lock', [user.id])}
                            >
                              <Ban size={16} />
                            </button>
                          ))
                        : null}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="table-footer">
                <span className="table-footer-meta">
                  Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredUsers.length)} trên {filteredUsers.length} tài khoản
                </span>
                <div className="pagination">
                  <button className="page-btn" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Trước</button>
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <button key={index + 1} className={`page-btn ${safePage === index + 1 ? 'active' : ''}`} onClick={() => setPage(index + 1)}>
                      {index + 1}
                    </button>
                  ))}
                  <button className="page-btn" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>Sau</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <AdminConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.mode === 'lock' ? 'Khóa tài khoản người dùng' : 'Mở khóa tài khoản người dùng'}
        description={
          confirmState?.mode === 'lock'
            ? 'Tài khoản sẽ bị chặn đăng nhập cho đến khi được mở khóa lại.'
            : 'Tài khoản sẽ được phục hồi quyền đăng nhập theo vai trò hiện tại.'
        }
        selectedItems={confirmState?.selectedItems}
        selectedNoun="tài khoản"
        confirmLabel={actionLoading ? 'Đang xử lý...' : confirmState?.mode === 'lock' ? 'Xác nhận khóa' : 'Xác nhận mở khóa'}
        danger={confirmState?.mode === 'lock'}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (actionLoading) return;
          void applyStatusChange();
        }}
      />

      <Drawer open={Boolean(detailUser)} onClose={() => setDetailUser(null)} className="user-drawer">
        {detailUser ? (
          <>
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Hồ sơ người dùng</p>
                <h3>{detailUser.name || detailUser.email}</h3>
              </div>
              <button className="admin-icon-btn" onClick={() => setDetailUser(null)} aria-label="Đóng hồ sơ người dùng">
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              <section className="drawer-section">
                <h4>Tổng quan tài khoản</h4>
                <div className="user-drawer-hero">
                  <div className="user-avatar large">
                    <span>{(detailUser.name || detailUser.email || 'U').charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="admin-bold">{detailUser.name || 'Chưa cập nhật tên'}</div>
                    <div className="admin-muted">{detailUser.email}</div>
                  </div>
                  <span className={`admin-pill ${statusTone(detailUser.status)}`}>{statusLabel(detailUser.status)}</span>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Danh tính và quyền truy cập</h4>
                <div className="admin-card-list">
                  <div className="admin-card-row">
                    <span className="admin-bold"><UserRound size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Vai trò</span>
                    <span className="admin-muted">{roleLabel(detailUser.role)}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Điện thoại</span>
                    <span className="admin-muted">{detailUser.phone || 'Chưa có số điện thoại'}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Giới tính</span>
                    <span className="admin-muted">{genderLabel(detailUser.gender)}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Ngày sinh</span>
                    <span className="admin-muted">{formatDob(detailUser.dateOfBirth)}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Điểm tích lũy</span>
                    <span className="admin-muted">{(detailUser.loyaltyPoints ?? 0).toLocaleString('vi-VN')} điểm</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Ngày tham gia</span>
                    <span className="admin-muted">{new Date(detailUser.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Phạm vi</span>
                    <span className="admin-muted">
                      {detailUser.role === 'VENDOR'
                        ? detailUser.storeName || 'Chưa gán gian hàng'
                        : detailUser.role === 'SUPER_ADMIN'
                          ? 'Toàn bộ marketplace'
                          : 'Mua sắm trên marketplace'}
                    </span>
                  </div>
                  {detailUser.storeName && (
                    <div className="admin-card-row">
                      <span className="admin-bold">Gian hàng</span>
                      <span className="admin-muted">{detailUser.storeName}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="drawer-section">
                <h4>Tín hiệu nghiệp vụ</h4>
                <div className="user-signal-grid user-signal-grid-compact">
                  <div className="user-signal-card">
                    <span className="admin-muted small">Đăng nhập</span>
                    <strong>{detailUser.status === 'LOCKED' ? 'Bị chặn' : 'Cho phép'}</strong>
                  </div>
                  <div className="user-signal-card">
                    <span className="admin-muted small">Store status</span>
                    <strong>{detailUser.storeApprovalStatus || '-'}</strong>
                  </div>
                  <div className="user-signal-card">
                    <span className="admin-muted small">Account status</span>
                    <strong>{statusLabel(detailUser.status)}</strong>
                  </div>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Ghi chú vận hành</h4>
                <p className="admin-muted user-note">
                  {detailUser.note || 'Chưa có ghi chú nội bộ cho tài khoản này.'}
                </p>
              </section>
            </div>

            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={() => setDetailUser(null)}>Đóng</button>
              {canManageUser(detailUser)
                ? (detailUser.status === 'LOCKED' ? (
                    <button className="admin-primary-btn" onClick={() => openConfirm('unlock', [detailUser.id])}>
                      <ShieldCheck size={14} />
                      Mở khóa tài khoản
                    </button>
                  ) : (
                    <button className="admin-ghost-btn danger" onClick={() => openConfirm('lock', [detailUser.id])}>
                      <Shield size={14} />
                      Khóa tài khoản
                    </button>
                  ))
                : <span className="admin-muted small">Tài khoản SUPER_ADMIN không thể bị khóa.</span>}
            </div>
          </>
        ) : null}
      </Drawer>
    </AdminLayout>
  );
};

export default AdminUsers;
