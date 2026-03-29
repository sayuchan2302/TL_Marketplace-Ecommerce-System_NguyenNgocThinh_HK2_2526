import './Admin.css';
import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check, XCircle, Eye } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import { useAdminToast } from './useAdminToast';
import { returnService, type ReturnRequest, type ReturnStatus } from '../../services/returnService';
import { PanelTabs } from '../../components/Panel/PanelPrimitives';
import Drawer from '../../components/Drawer/Drawer';
import {
  toDisplayOrderCode,
  toDisplayReturnCode,
} from '../../utils/displayCode';

const statusConfig: Record<ReturnStatus, { label: string; pillClass: string }> = {
  PENDING:   { label: 'Chờ duyệt',  pillClass: 'admin-pill pending' },
  APPROVED:  { label: 'Đã duyệt',   pillClass: 'admin-pill success' },
  REJECTED:  { label: 'Đã từ chối', pillClass: 'admin-pill danger' },
  COMPLETED: { label: 'Đã hoàn',    pillClass: 'admin-pill neutral' },
};

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'completed', label: 'Đã hoàn' },
  { key: 'rejected', label: 'Đã từ chối' },
] as const;

type TabKey = typeof TABS[number]['key'];

const PAGE_SIZE = 20;

const AdminReturns = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allReturns, setAllReturns] = useState<ReturnRequest[]>([]);
  const [tabCounts, setTabCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [drawerItem, setDrawerItem] = useState<ReturnRequest | null>(null);
  const [drawerNote, setDrawerNote] = useState('');
  const { pushToast } = useAdminToast();

  const statusFilter: ReturnStatus | null =
    activeTab === 'pending' ? 'PENDING'
      : activeTab === 'approved' ? 'APPROVED'
        : activeTab === 'completed' ? 'COMPLETED'
          : activeTab === 'rejected' ? 'REJECTED'
            : null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const [res, allRes, pendingRes, approvedRes, completedRes, rejectedRes] = await Promise.all([
          returnService.listAdmin({
            status: statusFilter || undefined,
            page: 0,
            size: PAGE_SIZE,
          }),
          returnService.listAdmin({ page: 0, size: 1 }),
          returnService.listAdmin({ status: 'PENDING', page: 0, size: 1 }),
          returnService.listAdmin({ status: 'APPROVED', page: 0, size: 1 }),
          returnService.listAdmin({ status: 'COMPLETED', page: 0, size: 1 }),
          returnService.listAdmin({ status: 'REJECTED', page: 0, size: 1 }),
        ]);
        if (!active) return;
        setAllReturns(res.content);
        setTabCounts({
          all: allRes.totalElements,
          pending: pendingRes.totalElements,
          approved: approvedRes.totalElements,
          completed: completedRes.totalElements,
          rejected: rejectedRes.totalElements,
        });
      } catch {
        if (active) pushToast('Không tải được danh sách đối trả');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [statusFilter, pushToast]);

  const filteredItems = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    if (!searchText) return allReturns;
    return allReturns.filter((item) =>
      item.id.toLowerCase().includes(searchText) ||
      (item.code || '').toLowerCase().includes(searchText) ||
      (item.orderCode || '').toLowerCase().includes(searchText) ||
      (item.customerName || '').toLowerCase().includes(searchText)
    );
  }, [allReturns, searchQuery]);

  const pagedItems = filteredItems;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(pagedItems.map((r) => r.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const applyStatus = async (id: string, status: ReturnStatus) => {
    try {
      const updated = await returnService.updateStatus(id, status, drawerNote);
      setAllReturns((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setDrawerItem((current) => (current && current.id === id ? updated : current));
      pushToast(`Đã cập nhật trạng thái yêu cầu trả hàng`);
      setDrawerNote('');
    } catch {
      pushToast('Không thể cập nhật trạng thái yêu cầu');
    }
  };

  const resetCurrentView = () => {
    setActiveTab('all');
    setSearchQuery('');
    setSelected(new Set());
  };

  return (
    <AdminLayout
      title="Hoàn đơn"
      breadcrumbs={['Đơn hàng', 'Quản lý hoàn trả']}
      actions={(
        <div className="admin-actions">
          <div className="admin-search">
            <Search size={16} />
            <input
              placeholder="Tìm theo mã yêu cầu, đơn hàng hoặc tên khách"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>Đặt lại</button>
        </div>
      )}
    >
      <PanelTabs
        items={TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: tabCounts[tab.key],
        }))}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          {isLoading ? (
            <AdminStateBlock type="empty" title="Đang tải danh sách hoàn trả" description="Đang đồng bộ dữ liệu từ hệ thống." />
          ) : filteredItems.length === 0 ? (
            <AdminStateBlock
              type={searchQuery.trim() ? 'search-empty' : 'empty'}
              title={searchQuery.trim() ? 'Không tìm thấy yêu cầu phù hợp' : 'Chưa có yêu cầu hoàn trả'}
              description={searchQuery.trim() ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc.' : 'Khi khách gửi yêu cầu trả hàng, danh sách sẽ xuất hiện tại đây.'}
              actionLabel="Đặt lại"
              onAction={resetCurrentView}
            />
          ) : (
            <>
              <div className="admin-table" role="table" aria-label="Bảng yêu cầu hoàn trả">
                <div className="admin-table-row admin-table-head" role="row">
                  <div role="columnheader">
                    <input type="checkbox" checked={selected.size === pagedItems.length && pagedItems.length > 0} onChange={(e) => toggleAll(e.target.checked)} />
                  </div>
                  <div role="columnheader">Mã yêu cầu</div>
                  <div role="columnheader">Sản phẩm</div>
                  <div role="columnheader">Khách hàng / Gian hàng</div>
                  <div role="columnheader">Lý do</div>
                  <div role="columnheader">Trạng thái</div>
                  <div role="columnheader">Hành động</div>
                </div>

                {pagedItems.map((item) => (
                  <div key={item.id} className="admin-table-row" role="row" onClick={() => setDrawerItem(item)} style={{ cursor: 'pointer' }}>
                    <div role="cell" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={(e) => toggleOne(item.id, e.target.checked)} />
                    </div>
                    <div role="cell">
                      <span className="admin-bold">{toDisplayReturnCode(item.code)}</span>
                    </div>
                    <div role="cell">
                      <div className="admin-line-clamp" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={item.items.map(i => i.productName).join(', ')}>
                        {item.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}
                      </div>
                    </div>
                    <div role="cell">
                      <div className="admin-bold">{item.customerName}</div>
                      <div className="admin-muted small">Shop: {item.storeName || 'Chưa xác định'}</div>
                    </div>
                    <div role="cell"><span className="admin-muted">{item.reason}</span></div>
                    <div role="cell"><span className={statusConfig[item.status].pillClass}>{statusConfig[item.status].label}</span></div>
                    <div role="cell" className="admin-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="admin-icon-btn subtle" title="Xem chi tiết" onClick={() => setDrawerItem(item)}><Eye size={16} /></button>
                      {item.status === 'PENDING' && (
                        <>
                          <button className="admin-icon-btn subtle" title="Duyệt" onClick={() => void applyStatus(item.id, 'APPROVED')}><Check size={16} /></button>
                          <button className="admin-icon-btn subtle danger-icon" title="Từ chối" onClick={() => void applyStatus(item.id, 'REJECTED')}><XCircle size={16} /></button>
                        </>
                      )}
                      {item.status === 'APPROVED' && (
                        <button className="admin-icon-btn subtle" title="Hoàn tất" onClick={() => void applyStatus(item.id, 'COMPLETED')}><Check size={16} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="table-footer">
                <span className="table-footer-meta">Hiển thị {pagedItems.length} yêu cầu</span>
              </div>
            </>
          )}
        </div>
      </section>

      <Drawer open={Boolean(drawerItem)} onClose={() => { setDrawerItem(null); setDrawerNote(''); }}>
        {drawerItem ? (
          <>
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Yêu cầu hoàn trả</p>
                <h3>{toDisplayReturnCode(drawerItem.code)}</h3>
              </div>
              <button className="admin-icon-btn" onClick={() => { setDrawerItem(null); setDrawerNote(''); }}><X size={16} /></button>
            </div>
            <div className="drawer-body">
              <section className="drawer-section">
                <h4>Thông tin yêu cầu</h4>
                <div className="admin-card-list">
                  <div className="admin-card-row"><span className="admin-bold">Đơn hàng</span><span className="admin-muted">{toDisplayOrderCode(drawerItem.orderCode)}</span></div>
                  <div className="admin-card-row"><span className="admin-bold">Khách hàng</span><span className="admin-muted">{drawerItem.customerName}</span></div>
                  <div className="admin-card-row"><span className="admin-bold">Trạng thái</span><span className={statusConfig[drawerItem.status].pillClass}>{statusConfig[drawerItem.status].label}</span></div>
                  <div className="admin-card-row"><span className="admin-bold">Lý do</span><span className="admin-muted">{drawerItem.reason}</span></div>
                </div>
              </section>

              {drawerItem.items.length > 0 && (
                <section className="drawer-section">
                  <h4>Sản phẩm trả lại</h4>
                  {drawerItem.items.map((item) => (
                    <div key={item.orderItemId} className="admin-card-row">
                      <span className="admin-bold">{item.productName}</span>
                      <span className="admin-muted">x{item.quantity}</span>
                    </div>
                  ))}
                </section>
              )}

              <section className="drawer-section">
                <h4>Ghi chú kiểm duyệt</h4>
                <textarea
                  value={drawerNote}
                  onChange={(e) => setDrawerNote(e.target.value)}
                  rows={3}
                  placeholder="Nhập ghi chú nội bộ..."
                  className="content-form-textarea"
                />
              </section>
            </div>
            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={() => { setDrawerItem(null); setDrawerNote(''); }}>Đóng</button>
              {drawerItem.status === 'PENDING' && (
                <>
                  <button className="admin-ghost-btn danger" onClick={() => void applyStatus(drawerItem.id, 'REJECTED')}><XCircle size={14} /> Từ chối</button>
                  <button className="admin-primary-btn" onClick={() => void applyStatus(drawerItem.id, 'APPROVED')}><Check size={14} /> Duyệt</button>
                </>
              )}
              {drawerItem.status === 'APPROVED' && (
                <button className="admin-primary-btn" onClick={() => void applyStatus(drawerItem.id, 'COMPLETED')}><Check size={14} /> Hoàn tất</button>
              )}
            </div>
          </>
        ) : null}
      </Drawer>
    </AdminLayout>
  );
};

export default AdminReturns;
