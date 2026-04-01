import './Admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, ShieldBan } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import { PanelStatsGrid, PanelTableFooter, PanelTabs } from '../../components/Panel/PanelPrimitives';
import { useAdminToast } from './useAdminToast';
import ProductReviewModal from './ProductReviewModal';
import {
  bulkApproveProducts,
  listModerationProducts,
  rejectProductApproval,
  toggleProductApproval,
  type AdminModerationProduct,
  type ProductApprovalStatus,
} from './adminProductModerationService';
import { getUiErrorMessage } from '../../utils/errorMessage';

type StatusFilter = ProductApprovalStatus | 'ALL';

const PAGE_SIZE = 12;

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'REJECTED', label: 'Từ chối' },
  { key: 'BANNED', label: 'Bị chặn' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('vi-VN');
};

const statusLabel: Record<StatusFilter, string> = {
  ALL: 'Tất cả',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  BANNED: 'Bị chặn',
};

const statusPillClass = (status: ProductApprovalStatus) => {
  if (status === 'APPROVED') return 'admin-pill success';
  if (status === 'PENDING') return 'admin-pill pending';
  if (status === 'REJECTED') return 'admin-pill warning';
  return 'admin-pill danger';
};

const AdminProductGovernance = () => {
  const { toast, pushToast } = useAdminToast(2200);

  const [rows, setRows] = useState<AdminModerationProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<StatusFilter, number>>({
    ALL: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    BANNED: 0,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewingProduct, setReviewingProduct] = useState<AdminModerationProduct | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');

  const baseFilterParams = useMemo(
    () => ({
      sort: 'createdAt,desc',
    }),
    [],
  );

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const response = await listModerationProducts({
        ...baseFilterParams,
        page,
        size: PAGE_SIZE,
        status: statusFilter,
      });

      setRows(response.content);
      setTotalPages(Math.max(response.totalPages, 1));
      setTotalElements(response.totalElements);
      setSelected((prev) => {
        if (prev.size === 0) return prev;
        const idsOnPage = new Set(response.content.map((item) => item.id));
        const next = new Set<string>();
        prev.forEach((id) => {
          if (idsOnPage.has(id)) next.add(id);
        });
        return next;
      });
    } catch (error: unknown) {
      setRows([]);
      setTotalPages(1);
      setTotalElements(0);
      setLoadError(getUiErrorMessage(error, 'Không tải được danh sách kiểm duyệt sản phẩm.'));
    } finally {
      setIsLoading(false);
    }
  }, [baseFilterParams, page, statusFilter]);

  const loadStatusCounts = useCallback(async () => {
    try {
      const [allRes, pendingRes, approvedRes, rejectedRes, bannedRes] = await Promise.all([
        listModerationProducts({ ...baseFilterParams, page: 0, size: 1, status: 'ALL' }),
        listModerationProducts({ ...baseFilterParams, page: 0, size: 1, status: 'PENDING' }),
        listModerationProducts({ ...baseFilterParams, page: 0, size: 1, status: 'APPROVED' }),
        listModerationProducts({ ...baseFilterParams, page: 0, size: 1, status: 'REJECTED' }),
        listModerationProducts({ ...baseFilterParams, page: 0, size: 1, status: 'BANNED' }),
      ]);

      setTabCounts({
        ALL: allRes.totalElements,
        PENDING: pendingRes.totalElements,
        APPROVED: approvedRes.totalElements,
        REJECTED: rejectedRes.totalElements,
        BANNED: bannedRes.totalElements,
      });
    } catch {
      setTabCounts((prev) => prev);
    }
  }, [baseFilterParams]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadStatusCounts();
  }, [loadStatusCounts]);

  const selectedRows = useMemo(() => rows.filter((item) => selected.has(item.id)), [rows, selected]);
  const selectedIds = useMemo(() => selectedRows.map((item) => item.id), [selectedRows]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(rows.map((item) => item.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const refreshData = async (message?: string) => {
    await Promise.all([loadProducts(), loadStatusCounts()]);
    if (message) pushToast(message);
  };

  const handleApprove = async (product: AdminModerationProduct) => {
    try {
      setActionLoading(true);
      if (product.approvalStatus !== 'APPROVED') {
        await toggleProductApproval(product.id, 'APPROVED');
      }
      await refreshData(`Đã duyệt ${product.productCode}.`);
      setReviewingProduct(null);
    } catch (error: unknown) {
      pushToast(getUiErrorMessage(error, 'Không thể duyệt sản phẩm.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async (product: AdminModerationProduct) => {
    try {
      setActionLoading(true);
      if (product.approvalStatus !== 'BANNED') {
        await toggleProductApproval(product.id, 'BANNED');
      }
      await refreshData(`Đã chặn ${product.productCode}.`);
      setReviewingProduct(null);
    } catch (error: unknown) {
      pushToast(getUiErrorMessage(error, 'Không thể chặn sản phẩm.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (product: AdminModerationProduct, reason: string) => {
    try {
      setActionLoading(true);
      await rejectProductApproval(product.id, reason);
      await refreshData(`Đã từ chối ${product.productCode}.`);
      setReviewingProduct(null);
    } catch (error: unknown) {
      pushToast(getUiErrorMessage(error, 'Không thể từ chối sản phẩm.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      pushToast('Vui lòng chọn sản phẩm cần duyệt.');
      return;
    }

    try {
      setActionLoading(true);
      const result = await bulkApproveProducts(selectedIds);
      setSelected(new Set());
      await refreshData(`Đã duyệt ${result.updated}/${result.requested} sản phẩm.`);
    } catch (error: unknown) {
      pushToast(getUiErrorMessage(error, 'Không thể duyệt hàng loạt.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout title="Kiểm duyệt sản phẩm" breadcrumbs={['Gian hàng', 'Kiểm duyệt sản phẩm']}>
      <PanelStatsGrid
        items={[
          {
            key: 'all',
            label: 'Tổng sản phẩm',
            value: tabCounts.ALL,
            sub: 'Toàn bộ sản phẩm theo bộ lọc hiện tại',
            onClick: () => {
              setStatusFilter('ALL');
              setPage(0);
            },
          },
          {
            key: 'pending',
            label: 'Chờ duyệt',
            value: tabCounts.PENDING,
            sub: 'Đợi admin kiểm duyệt',
            tone: tabCounts.PENDING > 0 ? 'warning' : '',
            onClick: () => {
              setStatusFilter('PENDING');
              setPage(0);
            },
          },
          {
            key: 'approved',
            label: 'Đã duyệt',
            value: tabCounts.APPROVED,
            sub: 'Được phép hiển thị',
            tone: 'success',
            onClick: () => {
              setStatusFilter('APPROVED');
              setPage(0);
            },
          },
          {
            key: 'banned',
            label: 'Bị chặn',
            value: tabCounts.BANNED,
            sub: 'Vi phạm chính sách',
            tone: tabCounts.BANNED > 0 ? 'danger' : '',
            onClick: () => {
              setStatusFilter('BANNED');
              setPage(0);
            },
          },
        ]}
      />

      <PanelTabs
        items={STATUS_TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: tabCounts[tab.key],
        }))}
        activeKey={statusFilter}
        onChange={(key) => {
          setStatusFilter(key as StatusFilter);
          setSelected(new Set());
          setPage(0);
        }}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Danh sách sản phẩm kiểm duyệt</h2>
            <div className="admin-actions">
              {selected.size > 0 ? (
                <button className="admin-primary-btn" onClick={() => void handleBulkApprove()} disabled={actionLoading}>
                  <CheckCircle2 size={16} />
                  Duyệt đã chọn ({selected.size})
                </button>
              ) : (
                <span className="admin-muted moderation-total-text">Tổng {totalElements} sản phẩm</span>
              )}
            </div>
          </div>

          {isLoading ? (
            <AdminStateBlock
              type="empty"
              title="Đang tải danh sách kiểm duyệt"
              description="Hệ thống đang đồng bộ dữ liệu sản phẩm từ các gian hàng."
            />
          ) : loadError ? (
            <AdminStateBlock
              type="error"
              title="Không tải được danh sách sản phẩm"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => {
                void refreshData();
              }}
            />
          ) : rows.length === 0 ? (
            <AdminStateBlock
              type="empty"
              title="Không có sản phẩm trong trạng thái này"
              description="Hiện chưa có sản phẩm cần xử lý theo tiêu chí đang chọn."
            />
          ) : (
            <>
              <div className="admin-table moderation-table" role="table" aria-label="Danh sách kiểm duyệt sản phẩm">
                <div className="admin-table-row admin-table-head moderation-row" role="row">
                  <div role="columnheader">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={(event) => toggleAll(event.target.checked)}
                      aria-label="Chọn tất cả"
                    />
                  </div>
                  <div role="columnheader">Sản phẩm</div>
                  <div role="columnheader">Gian hàng</div>
                  <div role="columnheader" className="moderation-col-category">Danh mục</div>
                  <div role="columnheader">Giá</div>
                  <div role="columnheader">Sales / Stock</div>
                  <div role="columnheader">Trạng thái</div>
                  <div role="columnheader">Thao tác</div>
                </div>

                {rows.map((product) => (
                  <motion.div key={product.id} className="admin-table-row moderation-row" role="row" whileHover={{ y: -1 }}>
                    <div role="cell">
                      <input
                        type="checkbox"
                        checked={selected.has(product.id)}
                        onChange={(event) => toggleOne(product.id, event.target.checked)}
                        aria-label={`Chọn ${product.productCode}`}
                      />
                    </div>

                    <div role="cell" className="moderation-product-cell">
                      <img src={product.thumbnail || ''} alt={product.name} className="moderation-thumb" />
                      <div className="moderation-product-copy">
                        <p className="admin-bold moderation-truncate">{product.name}</p>
                        <p className="admin-muted small">{product.productCode}</p>
                      </div>
                    </div>

                    <div role="cell" className="moderation-store-cell">
                      {product.storeId ? (
                        <>
                          <Link to="/admin/stores" className="moderation-store-link">
                            {product.storeName || 'Không rõ gian hàng'}
                          </Link>
                          <p className="admin-muted small">{formatDate(product.createdAt)}</p>
                        </>
                      ) : (
                        <span className="admin-muted">No store</span>
                      )}
                    </div>

                    <div role="cell" className="moderation-col-category">
                      <span className="badge moderation-truncate">{product.categoryName || 'N/A'}</span>
                    </div>

                    <div role="cell" className="admin-bold">{formatCurrency(product.price)}</div>

                    <div role="cell" className="moderation-sales-stock">
                      <span>Sales: {product.sales.toLocaleString('vi-VN')}</span>
                      <small>Stock: {product.stock.toLocaleString('vi-VN')}</small>
                    </div>

                    <div role="cell">
                      <span className={statusPillClass(product.approvalStatus)}>{statusLabel[product.approvalStatus]}</span>
                    </div>

                    <div role="cell" className="admin-actions moderation-actions">
                      <button
                        className="admin-icon-btn subtle"
                        title="Xem kiểm duyệt"
                        onClick={() => setReviewingProduct(product)}
                        disabled={actionLoading}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="admin-icon-btn subtle moderation-icon-approve"
                        title="Duyệt"
                        onClick={() => {
                          void handleApprove(product);
                        }}
                        disabled={actionLoading}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        className="admin-icon-btn subtle moderation-icon-ban"
                        title="Chặn"
                        onClick={() => {
                          void handleBan(product);
                        }}
                        disabled={actionLoading}
                      >
                        <ShieldBan size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <PanelTableFooter
                meta={`Trang ${page + 1}/${totalPages} · ${rows.length} sản phẩm/trang`}
                page={page + 1}
                totalPages={totalPages}
                onPageChange={(next) => setPage(next - 1)}
                prevLabel="Trước"
                nextLabel="Sau"
              />
            </>
          )}
        </div>
      </section>

      <ProductReviewModal
        open={Boolean(reviewingProduct)}
        product={reviewingProduct}
        onClose={() => setReviewingProduct(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onBan={handleBan}
        loading={actionLoading}
      />

      {toast ? <div className="toast success">{toast}</div> : null}
    </AdminLayout>
  );
};

export default AdminProductGovernance;
