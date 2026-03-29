import './Admin.css';
import { Star, CheckCircle, EyeOff, Search, Filter, X, Trash2, Eye } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AdminStateBlock } from './AdminStateBlocks';
import { useAdminListState } from './useAdminListState';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import { PanelTabs } from '../../components/Panel/PanelPrimitives';
import { adminReviewService, type Review, type ReviewStatus } from './adminReviewService';
import { ADMIN_VIEW_KEYS } from './adminListView';
import AdminConfirmDialog from './AdminConfirmDialog';
import Drawer from '../../components/Drawer/Drawer';
import { toDisplayOrderCode } from '../../utils/displayCode';

const normalizeStatus = (status?: string | null): ReviewStatus => {
  const normalized = status?.toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'hidden') return 'hidden';
  return 'pending';
};

const ReviewStatusBadge = ({ status }: { status?: ReviewStatus | string | null }) => {
  const config: Record<ReviewStatus, { label: string; pillClass: string }> = {
    pending: { label: 'Chờ duyệt', pillClass: 'admin-pill pending' },
    approved: { label: 'Đã duyệt', pillClass: 'admin-pill success' },
    hidden: { label: 'Đã ẩn', pillClass: 'admin-pill neutral' },
  };
  const { label, pillClass } = config[normalizeStatus(status)];
  return <span className={pillClass}>{label}</span>;
};

const RatingStars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={size}
        style={{ color: star <= rating ? '#facc15' : '#d1d5db', fill: star <= rating ? '#facc15' : 'none' }}
      />
    ))}
  </div>
);

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

const AdminReviews = () => {
  const { toast, pushToast } = useAdminToast();
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchReviews = async () => {
      setIsLoading(true);
      try {
        const res = await adminReviewService.getAll({ size: 1000 });
        if (active) {
          setAllReviews(res.content);
        }
      } catch {
        if (active) pushToast('Không tải được đánh giá');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchReviews();
    return () => { active = false; };
  }, [pushToast]);

  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.reviews,
    path: '/admin/reviews',
    validStatusKeys: ['all', 'pending', 'approved', 'hidden'],
    defaultStatus: 'all',
  });

  const filteredByStatus = useMemo(() => {
    if (view.status === 'all') return allReviews;
    return allReviews.filter((r) => r.status === view.status);
  }, [allReviews, view.status]);

  const {
    search,
    filteredItems,
    pagedItems,
    page,
    setPage,
    totalPages,
    startIndex,
    endIndex,
    next,
    prev,
  } = useAdminListState<Review>({
    items: filteredByStatus,
    pageSize: 8,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    getSearchText: (r) => `${r.productName} ${r.customerName} ${r.content} ${r.orderCode || ''}`,
    filterPredicate: () => true,
    loadingDeps: [view.status],
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerReview, setDrawerReview] = useState<Review | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; names: string[] } | null>(null);

  const stats = useMemo(() => {
    const total = allReviews.length;
    const pending = allReviews.filter((review) => review.status === 'pending').length;
    const approved = allReviews.filter((review) => review.status === 'approved').length;
    const averageRating = total ? allReviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;

    return {
      total,
      pending,
      approved,
      averageRating,
    };
  }, [allReviews]);
  const tabCounts = useMemo(() => ({
    all: allReviews.length,
    pending: allReviews.filter((r) => r.status === 'pending').length,
    approved: allReviews.filter((r) => r.status === 'approved').length,
    hidden: allReviews.filter((r) => r.status === 'hidden').length,
  }), [allReviews]);

  const applyStatusUpdate = useCallback(async (id: string, status: ReviewStatus) => {
    try {
      const updated = await adminReviewService.updateStatus(id, status);
      setAllReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return updated;
    } catch {
      pushToast('Lỗi cập nhật trạng thái');
      return null;
    }
  }, [pushToast]);

  const handleApprove = useCallback(async (id: string) => {
    if (await applyStatusUpdate(id, 'approved')) pushToast('Đã duyệt đánh giá.');
  }, [applyStatusUpdate, pushToast]);

  const handleHide = useCallback(async (id: string) => {
    if (await applyStatusUpdate(id, 'hidden')) pushToast('Đã ẩn đánh giá.');
  }, [applyStatusUpdate, pushToast]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await Promise.all(deleteTarget.ids.map((id) => adminReviewService.delete(id)));
      setAllReviews((prev) => prev.filter((r) => !deleteTarget.ids.includes(r.id)));
      pushToast('Đã xóa đánh giá.');
    } catch {
      pushToast('Lỗi khi xóa đánh giá.');
    } finally {
      setSelected(new Set());
      setDeleteTarget(null);
      if (drawerReview && deleteTarget.ids.includes(drawerReview.id)) {
        setDrawerReview(null);
      }
    }
  };

  const resetCurrentView = () => {
    view.resetCurrentView();
    setSelected(new Set());
  };



  return (
    <AdminLayout
      title="Đánh giá"
      breadcrumbs={['Đánh giá', 'Kiểm duyệt']}
      actions={
        <>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder="Tìm đánh giá, khách hàng, sản phẩm hoặc nội dung" value={search} onChange={(e) => view.setSearch(e.target.value)} />
          </div>
          <button className="admin-ghost-btn" onClick={() => pushToast('Bộ lọc dispute signal sẽ bổ sung sau.')}>
            <Filter size={16} />
            Lọc
          </button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>Đặt lại</button>
        </>
      }
    >
      <div className="admin-stats grid-4">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng đánh giá</div>
          <div className="admin-stat-value">{stats.total}</div>
          <div className="admin-stat-sub">Tất cả phản hồi từ khách hàng trên marketplace</div>
        </div>
        <div className={`admin-stat-card ${tabCounts.pending > 0 ? 'warning' : ''}`} onClick={() => view.setStatus('pending')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Chờ duyệt</div>
          <div className="admin-stat-value">{stats.pending}</div>
          <div className="admin-stat-sub">Cần duyệt, ẩn hoặc escalated</div>
        </div>
        <div className="admin-stat-card success" onClick={() => view.setStatus('approved')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Đã duyệt</div>
          <div className="admin-stat-value">{stats.approved}</div>
          <div className="admin-stat-sub">Đang hiển thị trên storefront và chi tiết sản phẩm</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Đánh giá trung bình</div>
          <div className="admin-stat-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {stats.averageRating.toFixed(1)}
            <Star size={18} style={{ color: '#facc15', fill: '#facc15' }} />
          </div>
          <div className="admin-stat-sub">Tín hiệu sức khỏe của trải nghiệm mua hàng</div>
        </div>
      </div>

      <PanelTabs
        items={[
          { key: 'all', label: 'Tất cả', count: tabCounts.all },
          { key: 'pending', label: 'Chờ duyệt', count: tabCounts.pending },
          { key: 'approved', label: 'Đã duyệt', count: tabCounts.approved },
          { key: 'hidden', label: 'Đã ẩn', count: tabCounts.hidden },
        ]}
        activeKey={view.status}
        onChange={(key) => view.setStatus(key)}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Hàng đợi kiểm duyệt</h2>
            {selected.size > 0 && (
              <div className="admin-actions">
                <span className="admin-muted">{selected.size} đã chọn</span>
                <button className="admin-ghost-btn" onClick={async () => {
                  const selectedIds = filteredItems.filter((review) => selected.has(review.id)).map((review) => review.id);
                  await Promise.all(selectedIds.map((id) => applyStatusUpdate(id, 'approved')));
                  setSelected(new Set());
                  pushToast('Đã duyệt đánh giá đã chọn.');
                }}>
                  <CheckCircle size={15} />
                  Duyệt
                </button>
                <button className="admin-ghost-btn" onClick={async () => {
                  const selectedIds = filteredItems.filter((review) => selected.has(review.id)).map((review) => review.id);
                  await Promise.all(selectedIds.map((id) => applyStatusUpdate(id, 'hidden')));
                  setSelected(new Set());
                  pushToast('Đã ẩn đánh giá đã chọn.');
                }}>
                  <EyeOff size={15} />
                  Ẩn
                </button>
                <button className="admin-ghost-btn danger" onClick={() => {
                  const targets = filteredItems.filter((r) => selected.has(r.id));
                  setDeleteTarget({ ids: targets.map((r) => r.id), names: targets.map((r) => r.productName) });
                }}>
                  <Trash2 size={15} />
                  Xóa
                </button>
              </div>
            )}
           
          </div>

          {isLoading ? (
            <AdminStateBlock type="empty" title="Đang tải dữ liệu" description="Hệ thống đang đồng bộ với backend..." />
          ) : filteredItems.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'Không tìm thấy đánh giá phù hợp' : 'Chưa có đánh giá trong hàng đợi duyệt'}
              description={search.trim() ? 'Thử đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc.' : 'Đánh giá mới sẽ xuất hiện tại đây để admin giám sát và xử lý duyệt.'}
              actionLabel="Đặt lại"
              onAction={resetCurrentView}
            />
          ) : (
            <>
              <div className="admin-table" role="table" aria-label="Bảng duyệt đánh giá">
                <div className="admin-table-row admin-table-head reviews" role="row">
                  <div role="columnheader">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredItems.length && filteredItems.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filteredItems.map((r) => r.id)) : new Set())}
                    />
                  </div>
                  <div role="columnheader">Sản phẩm</div>
                  <div role="columnheader">Khách hàng</div>
                  <div role="columnheader">Đánh giá</div>
                  <div role="columnheader">Ngày</div>
                  <div role="columnheader">Trạng thái</div>
                  <div role="columnheader" style={{ textAlign: 'right', paddingRight: '12px' }}>Hành động</div>
                </div>

                {pagedItems.map((review) => (
                  <motion.div
                    key={review.id}
                    className="admin-table-row reviews"
                    role="row"
                    whileHover={{ y: -1 }}
                    onClick={() => {
                      setDrawerReview(review);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div role="cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(review.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(review.id);
                          else next.delete(review.id);
                          setSelected(next);
                        }}
                      />
                    </div>
                    <div role="cell">
                      <div className="admin-customer">
                        <img src={review.productImage} alt={review.productName} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="admin-bold">{review.productName}</span>
                          <span className="admin-muted small">Order #{toDisplayOrderCode(review.orderCode)}</span>
                        </div>
                      </div>
                    </div>
                    <div role="cell" className="customer-info-cell">
                      <div className="customer-avatar initials">{getInitials(review.customerName)}</div>
                      <div className="customer-text">
                        <p className="admin-bold customer-name">{review.customerName}</p>
                        <p className="admin-muted customer-email">{review.customerEmail}</p>
                      </div>
                    </div>
                    <div role="cell"><RatingStars rating={review.rating} /></div>
                    <div role="cell" className="order-date admin-muted">{formatDate(review.date)}</div>
                    <div role="cell"><ReviewStatusBadge status={review.status} /></div>
                    <div role="cell" className="admin-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="admin-icon-btn subtle" title="Xem chi tiết" onClick={() => { setDrawerReview(review); }}>
                        <Eye size={16} />
                      </button>
                      {review.status === 'pending' && (
                        <button className="admin-icon-btn subtle" onClick={() => handleApprove(review.id)} title="Duyệt">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {review.status !== 'hidden' && (
                        <button className="admin-icon-btn subtle" onClick={() => handleHide(review.id)} title="Ẩn">
                          <EyeOff size={16} />
                        </button>
                      )}
                      <button className="admin-icon-btn subtle danger-icon" onClick={() => setDeleteTarget({ ids: [review.id], names: [review.productName] })} title="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="table-footer">
                <span className="table-footer-meta">Hiển thị {startIndex}-{endIndex} của {filteredItems.length} đánh giá</span>
                <div className="pagination">
                  <button className="page-btn" onClick={prev} disabled={page === 1}>Trước</button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i + 1} className={`page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>
                      {i + 1}
                    </button>
                  ))}
                  <button className="page-btn" onClick={next} disabled={page === totalPages}>Tiếp</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <Drawer open={Boolean(drawerReview)} onClose={() => setDrawerReview(null)}>
        {drawerReview ? (
          <>
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Duyệt đánh giá</p>
                <h3>{drawerReview.productName}</h3>
              </div>
              <button className="admin-icon-btn" onClick={() => { setDrawerReview(null); }} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              <section className="drawer-section">
                <p className="admin-label" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Thông tin sản phẩm</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={drawerReview.productImage} alt={drawerReview.productName} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                  <div>
                    <p className="admin-bold" style={{ margin: 0 }}>{drawerReview.productName}</p>
                    <p className="admin-muted small" style={{ margin: 0 }}>Mã đơn hàng: #{toDisplayOrderCode(drawerReview.orderCode)}</p>
                  </div>
                </div>
              </section>

              <section className="drawer-section">
                <p className="admin-label" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Phản hồi khách hàng</p>
                <div className="admin-card-list">
                  <div className="admin-card-row">
                    <span className="admin-bold">{drawerReview.customerName}</span>
                    <RatingStars rating={drawerReview.rating} size={16} />
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-muted small">{formatDate(drawerReview.date)}</span>
                    <ReviewStatusBadge status={drawerReview.status} />
                  </div>
                </div>
              </section>

              <section className="drawer-section">
                <p className="admin-label" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Nội dung đánh giá</p>
                <div className="admin-note">{drawerReview.content}</div>
              </section>

              <section className="drawer-section">
                <p className="admin-label" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Phản hồi từ người bán</p>
                {drawerReview.reply ? (
                  <div className="admin-note" style={{ background: '#eff6ff', color: '#1e40af' }}>{drawerReview.reply}</div>
                ) : (
                  <p className="admin-muted small" style={{ fontStyle: 'italic' }}>Chưa có phản hồi từ shop. Admin chỉ theo dõi và kiểm duyệt, còn seller sẽ phản hồi ở panel riêng.</p>
                )}
              </section>

              <section className="drawer-section">
                <div className="admin-actions" style={{ flexWrap: 'wrap' }}>
                  {drawerReview.status === 'pending' && (
                    <button className="admin-primary-btn" onClick={() => { handleApprove(drawerReview.id); setDrawerReview(null); }}>
                      <CheckCircle size={15} />
                      Duyệt
                    </button>
                  )}
                  {drawerReview.status !== 'hidden' && (
                    <button className="admin-ghost-btn" onClick={() => { handleHide(drawerReview.id); setDrawerReview(null); }}>
                      <EyeOff size={15} />
                      Ẩn
                    </button>
                  )}
                  <button className="admin-ghost-btn danger" style={{ marginLeft: 'auto' }} onClick={() => setDeleteTarget({ ids: [drawerReview.id], names: [drawerReview.productName] })}>
                    <Trash2 size={15} />
                    Xóa
                  </button>
                </div>
              </section>
            </div>

            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={() => { setDrawerReview(null); }}>Đóng</button>
            </div>
          </>
        ) : null}
      </Drawer>

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa đánh giá"
        description="Bạn có chắc chắn muốn xóa đánh giá này khỏi hệ thống kiểm duyệt? Hành động này không thể hoàn tác."
        selectedItems={deleteTarget?.names}
        selectedNoun="review"
        confirmLabel="Xóa đánh giá"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminReviews;
