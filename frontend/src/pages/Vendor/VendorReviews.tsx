import './Vendor.css';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Link2, MessageSquare, Star } from 'lucide-react';
import VendorLayout from './VendorLayout';
import { PanelFloatingBar, PanelStatsGrid, PanelTabs } from '../../components/Panel/PanelPrimitives';
import {
  PanelDrawerFooter,
  PanelDrawerHeader,
  PanelDrawerSection,
  PanelSearchField,
} from '../../components/Panel/PanelPrimitives';
import { reviewService, type Review } from '../../services/reviewService';
import { useToast } from '../../contexts/ToastContext';
import { AdminStateBlock } from '../Admin/AdminStateBlocks';
import AdminConfirmDialog from '../Admin/AdminConfirmDialog';
import Drawer from '../../components/Drawer/Drawer';
import { getUiErrorMessage } from '../../utils/errorMessage';
import { copyTextToClipboard } from './vendorHelpers';
import { toDisplayOrderCode } from '../../utils/displayCode';

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'need_reply', label: 'Cần phản hồi' },
  { key: 'negative', label: 'Đánh giá tiêu cực' },
] as const;

const RatingStars = ({ rating }: { rating: number }) => (
  <div className="vendor-rating-stars">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={14}
        style={{
          color: star <= rating ? '#facc15' : '#d1d5db',
          fill: star <= rating ? '#facc15' : 'none',
        }}
      />
    ))}
  </div>
);

const VendorReviews = () => {
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'need_reply' | 'negative'>('all');
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [confirmReplyIds, setConfirmReplyIds] = useState<string[] | null>(null);
  const [replyingIds, setReplyingIds] = useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const canVendorReply = reviewService.canVendorReply();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const rows = await reviewService.getVendorReviews({ size: 1000 });
        if (!mounted) return;
        setAllReviews(rows);
      } catch (err: unknown) {
        if (!mounted) return;
        setAllReviews([]);
        setLoadError(getUiErrorMessage(err, 'Không tải được đánh giá của cửa hàng.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const reviews = useMemo(() => {
    return allReviews.filter((review) => {
      const keyword = query.trim().toLowerCase();
      const matchesSearch =
        !keyword || `${review.productName} ${review.content} ${review.orderCode || ''}`.toLowerCase().includes(keyword);
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'need_reply'
            ? !review.shopReply
            : review.rating <= 3;
      return matchesSearch && matchesTab;
    });
  }, [activeTab, allReviews, query]);

  const stats = useMemo(() => {
    return {
      total: allReviews.length,
      needReply: allReviews.filter((review) => !review.shopReply).length,
      negative: allReviews.filter((review) => review.rating <= 3).length,
      average: allReviews.length
        ? (allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length).toFixed(1)
        : '0.0',
    };
  }, [allReviews]);

  const resetCurrentView = () => {
    setQuery('');
    setActiveTab('all');
    setSelected(new Set());
  };

  const shareCurrentView = async () => {
    const copied = await copyTextToClipboard(window.location.href);
    addToast(
      copied ? 'Đã sao chép bộ lọc hiện tại của đánh giá shop' : 'Không thể sao chép bộ lọc',
      copied ? 'success' : 'error',
    );
  };

  const submitReplies = async (ids: string[]) => {
    if (!canVendorReply) {
      addToast('Phiên đăng nhập hiện tại không hỗ trợ phản hồi đánh giá.', 'info');
      return;
    }

    const targets = ids.filter((id) => {
      const content = (replyDrafts[id] || '').trim();
      const review = allReviews.find((item) => item.id === id);
      return Boolean(content) && Boolean(review) && !review?.shopReply;
    });

    if (targets.length === 0) {
      addToast('Hãy nhập nội dung phản hồi trước khi gửi.', 'info');
      return;
    }

    setReplyingIds((current) => {
      const next = new Set(current);
      targets.forEach((id) => next.add(id));
      return next;
    });

    try {
      const updates = await Promise.all(
        targets.map(async (id) => {
          const content = (replyDrafts[id] || '').trim();
          const updated = await reviewService.replyAsVendor(id, content);
          return [id, updated] as const;
        }),
      );

      const updatedMap = new Map(updates);
      setAllReviews((current) => current.map((review) => updatedMap.get(review.id) || review));
      setReplyDrafts((current) => {
        const next = { ...current };
        targets.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setActiveReview((current) => {
        if (!current) return current;
        return updatedMap.get(current.id) || current;
      });
      setConfirmReplyIds(null);
      setSelected(new Set());
      addToast(
        targets.length > 1
          ? `Đã gửi phản hồi cho ${targets.length} đánh giá.`
          : 'Đã gửi phản hồi cho đánh giá.',
        'success',
      );
    } catch (err: unknown) {
      addToast(getUiErrorMessage(err, 'Không thể gửi phản hồi đánh giá.'), 'error');
    } finally {
      setReplyingIds((current) => {
        const next = new Set(current);
        targets.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const selectedNeedReply = Array.from(selected).filter((id) => {
    if (!canVendorReply) return false;
    const current = reviews.find((review) => review.id === id);
    return current && !current.shopReply && (replyDrafts[id] || '').trim();
  });
  const selectedReplyLabels = selectedNeedReply
    .map((id) => {
      const review = reviews.find((item) => item.id === id);
      if (!review) return null;
      return `${review.productName} - #${toDisplayOrderCode(review.orderCode)}`;
    })
    .filter((label): label is string => Boolean(label));

  const statItems = [
    {
      key: 'all',
      label: 'Tổng đánh giá',
      value: stats.total,
      sub: `Điểm trung bình: ${stats.average}`,
      onClick: () => setActiveTab('all'),
    },
    {
      key: 'need_reply',
      label: 'Cần phản hồi',
      value: stats.needReply,
      sub: 'Đánh giá chưa có phản hồi từ shop',
      tone: 'warning',
      onClick: () => setActiveTab('need_reply'),
    },
    {
      key: 'negative',
      label: 'Đánh giá ≤ 3 sao',
      value: stats.negative,
      sub: 'Tín hiệu cần chăm sóc ưu tiên',
      tone: 'info',
      onClick: () => setActiveTab('negative'),
    },
    {
      key: 'reply_rate',
      label: 'Tỷ lệ phản hồi',
      value: stats.total ? `${Math.round(((stats.total - stats.needReply) / stats.total) * 100)}%` : '0%',
      sub: 'Tỷ lệ đánh giá đã được shop chăm sóc',
      tone: 'success',
      onClick: () => setActiveTab('all'),
    },
  ] as const;

  const tabItems = TABS.map((tab) => ({ key: tab.key, label: tab.label }));


  return (
    <VendorLayout
      title="Đánh giá, phản hồi và uy tín shop"
      breadcrumbs={['Kênh Người Bán', 'Đánh giá và phản hồi']}
      actions={
        <>
          <PanelSearchField
            placeholder="Tìm theo sản phẩm, nội dung hoặc mã đơn"
            value={query}
            onChange={setQuery}
          />
          <button className="admin-ghost-btn" onClick={() => void shareCurrentView()}>
            <Link2 size={16} />
            Chia sẻ bộ lọc
          </button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>Đặt lại</button>
        </>
      }
    >
      <PanelStatsGrid items={[...statItems]} accentClassName="vendor-stat-button" />

      <PanelTabs
        items={tabItems}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'all' | 'need_reply' | 'negative')}
        accentClassName="vendor-active-tab"
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Danh sách đánh giá</h2>
              {!canVendorReply ? (
                <p className="admin-muted small">Bạn cần đăng nhập bằng tài khoản người bán để phản hồi đánh giá.</p>
              ) : null}
            </div>
          </div>
          {loading ? (
            <AdminStateBlock
              type="empty"
              title="Đang tải danh sách đánh giá"
              description="Hệ thống đang đồng bộ dữ liệu phản hồi của gian hàng."
            />
          ) : loadError ? (
            <AdminStateBlock
              type="empty"
              title="Không tải được đánh giá"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => setReloadKey((key) => key + 1)}
            />
          ) : reviews.length === 0 ? (
            <AdminStateBlock
              type={query.trim() ? 'search-empty' : 'empty'}
              title={query.trim() ? 'Không có đánh giá phù hợp' : 'Chưa có đánh giá cần xử lý'}
              description={
                query.trim()
                  ? 'Thử đổi từ khóa hoặc tab để xem lại hàng đợi phản hồi của shop.'
                  : 'Khi khách để lại đánh giá, kênh người bán sẽ hiển thị tại đây.'
              }
              actionLabel={query.trim() ? 'Đặt lại bộ lọc' : undefined}
              onAction={query.trim() ? resetCurrentView : undefined}
            />
          ) : (
            <div className="admin-table" role="table" aria-label="Bảng đánh giá của shop">
              <div className="admin-table-row vendor-reviews admin-table-head" role="row">
                <div role="columnheader">
                  <input
                    type="checkbox"
                    checked={selected.size === reviews.length && reviews.length > 0}
                    onChange={(event) => setSelected(event.target.checked ? new Set(reviews.map((item) => item.id)) : new Set())}
                  />
                </div>
                <div role="columnheader">Sản phẩm</div>
                <div role="columnheader">Đánh giá</div>
                <div role="columnheader">Nội dung</div>
                <div role="columnheader">Trạng thái</div>
                <div role="columnheader">Phản hồi</div>
                <div role="columnheader">Hành động</div>
              </div>

              {reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  className="admin-table-row vendor-reviews"
                  role="row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.14) }}
                  whileHover={{ y: -1 }}
                  onClick={() => setActiveReview(review)}
                  style={{ cursor: 'pointer' }}
                >
                  <div role="cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(review.id)}
                      onChange={(event) => {
                        const next = new Set(selected);
                        if (event.target.checked) next.add(review.id);
                        else next.delete(review.id);
                        setSelected(next);
                      }}
                    />
                  </div>
                  <div role="cell" className="vendor-admin-product-cell">
                    <img src={review.productImage} alt={review.productName} className="vendor-admin-thumb" />
                    <div className="vendor-admin-product-copy">
                      <div className="admin-bold">{review.productName}</div>
                      <div className="admin-muted small">Đơn #{toDisplayOrderCode(review.orderCode)}</div>
                    </div>
                  </div>
                  <div role="cell">
                    <RatingStars rating={review.rating} />
                    <div className="admin-muted small">{review.createdAt}</div>
                  </div>
                  <div role="cell" className="vendor-review-content">{review.content}</div>
                  <div role="cell">
                    <span className={`admin-pill ${review.rating <= 3 ? 'pending' : 'success'}`}>
                      {review.rating <= 3 ? 'Cần chăm sóc' : 'Ổn định'}
                    </span>
                  </div>
                  <div role="cell">
                    {review.shopReply ? (
                      <div className="vendor-reply-badge">
                        <span className="admin-bold">Đã phản hồi</span>
                        <span className="admin-muted small">{review.shopReply.createdAt}</span>
                      </div>
                    ) : (
                      <span className="badge amber">Chưa phản hồi</span>
                    )}
                  </div>
                  <div role="cell" className="admin-actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      className="admin-icon-btn subtle"
                      onClick={() => setActiveReview(review)}
                      aria-label="Xem chi tiết đánh giá"
                      title="Xem chi tiết đánh giá"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <PanelFloatingBar show={selected.size > 0} className="vendor-floating-bar">
        <div className="admin-floating-content">
          <span>Đã chọn {selected.size} đánh giá</span>
          <div className="admin-actions">
            <button className="admin-ghost-btn" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
            {selectedNeedReply.length > 0 ? (
              <button
                className="admin-ghost-btn"
                onClick={() => setConfirmReplyIds(selectedNeedReply)}
                disabled={selectedNeedReply.some((id) => replyingIds.has(id))}
              >
                Gửi phản hồi đã chọn
              </button>
            ) : null}
          </div>
        </div>
      </PanelFloatingBar>

      <AdminConfirmDialog
        open={Boolean(confirmReplyIds?.length)}
        title="Gửi phản hồi cho các đánh giá đã chọn"
        description="Các đánh giá này sẽ nhận phản hồi từ shop ngay sau khi xác nhận."
        selectedItems={selectedReplyLabels}
        selectedNoun="đánh giá"
        confirmLabel="Gửi phản hồi"
        onCancel={() => setConfirmReplyIds(null)}
        onConfirm={() => void submitReplies(confirmReplyIds || [])}
      />

      <Drawer open={Boolean(activeReview)} onClose={() => setActiveReview(null)}>
        {activeReview ? (
          <>
            <PanelDrawerHeader
              eyebrow="Chi tiết đánh giá"
              title={activeReview.productName}
              onClose={() => setActiveReview(null)}
              closeLabel="Đóng chi tiết đánh giá"
            />
            <div className="drawer-body">
              <PanelDrawerSection title="Thông tin đánh giá">
                <div className="admin-card-list">
                  <div className="admin-card-row">
                    <span className="admin-bold">Đơn hàng</span>
                    <span className="admin-muted">#{toDisplayOrderCode(activeReview.orderCode)}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Số sao</span>
                    <span><RatingStars rating={activeReview.rating} /></span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Nội dung</span>
                    <span className="admin-muted">{activeReview.content}</span>
                  </div>
                </div>
              </PanelDrawerSection>
              <PanelDrawerSection title="Phản hồi của shop">
                {activeReview.shopReply ? (
                  <div className="vendor-review-reply-box">
                    <strong>Đã phản hồi:</strong> {activeReview.shopReply.content}
                  </div>
                ) : canVendorReply ? (
                  <div className="form-grid">
                    <label className="form-field full">
                      <span>Nội dung phản hồi</span>
                      <textarea
                        rows={4}
                        value={replyDrafts[activeReview.id] || ''}
                        onChange={(event) =>
                          setReplyDrafts((current) => ({ ...current, [activeReview.id]: event.target.value }))
                        }
                        placeholder="Giải thích, xin lỗi hoặc hướng dẫn khách hàng..."
                      />
                    </label>
                  </div>
                ) : (
                  <div className="vendor-review-reply-box">
                    Bạn cần đăng nhập tài khoản người bán hợp lệ để gửi phản hồi đánh giá này.
                  </div>
                )}
              </PanelDrawerSection>
            </div>
            <PanelDrawerFooter>
              <button className="admin-ghost-btn" onClick={() => setActiveReview(null)}>Đóng</button>
              {!activeReview.shopReply && canVendorReply ? (
                <button
                  className="admin-primary-btn vendor-admin-primary"
                  onClick={() => void submitReplies([activeReview.id])}
                  disabled={replyingIds.has(activeReview.id)}
                >
                  <MessageSquare size={15} />
                  {replyingIds.has(activeReview.id) ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              ) : null}
            </PanelDrawerFooter>
          </>
        ) : null}
      </Drawer>
    </VendorLayout>
  );
};

export default VendorReviews;

