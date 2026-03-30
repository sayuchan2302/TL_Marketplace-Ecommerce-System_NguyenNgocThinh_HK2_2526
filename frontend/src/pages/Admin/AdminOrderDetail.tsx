import './Admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import AdminLayout from './AdminLayout';
import { Printer, XCircle, RotateCcw, Truck, User, Copy, Download, Save, Store, Percent } from 'lucide-react';
import {
  fulfillmentLabel,
  fulfillmentTransitions,
  paymentLabel,
  shipLabel,
  transitionReasonCatalog,
  type TransitionReasonCode,
  type FulfillmentStatus,
  type PaymentStatus,
} from './orderWorkflow';
import {
  getAdminOrderByIdentifier,
  subscribeAdminOrders,
  transitionAdminOrder,
  updateAdminOrderTracking,
  type AdminOrderRecord,
} from './adminOrderService';
import { AdminStateBlock } from './AdminStateBlocks';
import { useAdminToast } from './useAdminToast';
import { ADMIN_DICTIONARY } from './adminDictionary';
import { calculateCommission, formatCurrency } from '../../services/commissionService';
import { MARKETPLACE_DICTIONARY } from '../../utils/clientDictionary';
import { getUiErrorMessage } from '../../utils/errorMessage';
import { toDisplayOrderCode } from '../../utils/displayCode';
import '../../styles/orderDetailTheme.css';

const formatVND = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const AdminOrderDetailContent = ({ orderCode, routeId }: { orderCode: string; routeId?: string }) => {
  const t = ADMIN_DICTIONARY.orderDetail;
  const [order, setOrder] = useState<AdminOrderRecord | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, pushToast } = useAdminToast();
  const [pendingTransition, setPendingTransition] = useState<FulfillmentStatus | null>(null);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [reasonCode, setReasonCode] = useState<TransitionReasonCode>('other');
  const [reasonNote, setReasonNote] = useState('');
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);

  const fulfillment = order?.fulfillment || 'pending';
  const paymentStatus = order?.paymentStatus || 'unpaid';
  const timeline = order?.timeline || [];

  const statusOptions = useMemo(() => {
    const allowed = new Set<FulfillmentStatus>([fulfillment, ...fulfillmentTransitions[fulfillment]]);
    return (['pending', 'packing', 'shipping', 'done', 'canceled'] as FulfillmentStatus[]).filter(state => allowed.has(state));
  }, [fulfillment]);

  const nextPaymentStatusPreview = useMemo(() => {
    if (!pendingTransition) return paymentStatus;
    if (pendingTransition === 'done' && paymentStatus === 'cod_uncollected') return 'paid' as PaymentStatus;
    return paymentStatus;
  }, [pendingTransition, paymentStatus]);

  const fetchOrder = useCallback(async () => {
    try {
      setLoadError(null);
      if (orderCode) {
        const data = await getAdminOrderByIdentifier(orderCode);
        setOrder(data);
      }
    } catch (error: unknown) {
      setOrder(null);
      setLoadError(getUiErrorMessage(error, 'Không thể tải chi tiết đơn hàng từ backend.'));
    } finally {
      setIsInitializing(false);
    }
  }, [orderCode]);

  useEffect(() => {
    void fetchOrder();
    const unsubscribe = subscribeAdminOrders(fetchOrder);
    return unsubscribe;
  }, [fetchOrder]);

  if (isInitializing) {
    return (
      <AdminLayout title={t.title}>
        <div className="admin-loading" style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu đơn hàng...</div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout title={t.title}>
        {loadError ? (
          <AdminStateBlock
            type="error"
            title="Không tải được chi tiết đơn hàng"
            description={loadError}
            actionLabel="Thử lại"
            onAction={() => {
              setIsInitializing(true);
              void fetchOrder();
            }}
          />
        ) : (
          <AdminStateBlock type="error" title={t.notFound.title} description={t.notFound.description} />
        )}
      </AdminLayout>
    );
  }

  const total = order.pricing.subtotal + order.pricing.shipping - order.pricing.discount;

  const requestTransition = (next: FulfillmentStatus) => {
    if (next === fulfillment) return;
    const options = transitionReasonCatalog[next];
    if (options.length > 0) {
      setReasonCode(options[0].code);
    } else {
      setReasonCode('other');
    }
    setReasonNote('');
    setPendingTransition(next);
    setShowTransitionModal(true);
  };

  const updateFulfillment = async (next: FulfillmentStatus) => {
    if (next === fulfillment) return;
    const result = await transitionAdminOrder({
      code: order.code,
      nextFulfillment: next,
      actor: 'Admin',
      source: 'order_detail',
      reasonCode,
      reasonNote,
    });
     if (!result.ok) {
       pushToast(result.error || ADMIN_DICTIONARY.messages.orderDetail.transitionFailed);
       return;
     }
    setReasonCode('other');
    setReasonNote('');
    setPendingTransition(null);
    setShowTransitionModal(false);
    pushToast(result.message || t.messages.transitionSuccess(fulfillmentLabel(next)));
    void fetchOrder();
  };

  const exportAuditLog = () => {
    const payload = {
      orderCode: order.code,
      exportedAt: new Date().toISOString(),
      version: order.version,
      fulfillmentStatus: fulfillment,
      paymentStatus,
      timeline,
      auditLog: order.auditLog,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-${order.code}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    pushToast(ADMIN_DICTIONARY.messages.orderDetail.auditExported(order.code));
  };

  const saveTrackingNumber = async () => {
    const normalizedTracking = trackingInput.trim();
    if (!normalizedTracking) {
      pushToast('Vui lòng nhập mã vận đơn.');
      return;
    }

    setIsUpdatingTracking(true);
    const result = await updateAdminOrderTracking(order.code, normalizedTracking);
    setIsUpdatingTracking(false);

    if (!result.ok || !result.order) {
      pushToast(result.error || 'Không thể cập nhật mã vận đơn.');
      return;
    }

    setOrder(result.order);
    setIsEditingTracking(false);
    setTrackingInput('');
    pushToast(result.message || t.messages.trackingUpdated);
  };

  return (
    <AdminLayout
      title={
        <div className="od-title-row">
          <button className="admin-ghost-btn" onClick={() => window.history.back()} aria-label={t.back}>←</button>
          <span>{t.orderPrefix} #{toDisplayOrderCode(order.code || routeId)}</span>
        </div>
      }
      actions={(
        <div className="admin-actions">
          <select className="admin-select" aria-label={t.statusSelectLabel} value={fulfillment} onChange={(e) => requestTransition(e.target.value as FulfillmentStatus)}>
            {statusOptions.map(state => (
              <option key={state} value={state}>{fulfillmentLabel(state)}</option>
            ))}
          </select>
          <button className="admin-primary-btn dark"><Printer size={16} /> {t.actions.printInvoice}</button>
          <button className="admin-ghost-btn" disabled={!(fulfillment === 'canceled' && paymentStatus === 'paid')}><RotateCcw size={16} /> {t.actions.refund}</button>
          <button className="admin-ghost-btn danger" disabled={!fulfillmentTransitions[fulfillment].includes('canceled')} onClick={() => requestTransition('canceled')}><XCircle size={16} /> {t.actions.cancelOrder}</button>
        </div>
      )}
    >
      <motion.div
        className="order-detail-grid od-theme od-theme-admin"
      >
        <div className="od-left">
          <section className="od-section">
            <div className="od-section-head">
              <h2>{t.sections.orderItems}</h2>
            </div>
            <div className="od-items">
              {order.items.map(item => (
                <div key={item.id} className="od-item">
                  <img src={item.image} alt={item.name} />
                  <div className="od-item-info">
                    <p className="od-item-name">{item.name}</p>
                    <p className="od-item-variant"><strong>{item.color}</strong> · <strong>Size {item.size}</strong></p>
                    <p className="od-item-variant">Gian hàng: <strong>{order.storeName || 'Chưa xác định'}</strong></p>
                    <p className="od-item-price">{item.qty} x {formatVND(item.price)}</p>
                  </div>
                  <div className="od-item-total">{formatVND(item.qty * item.price)}</div>
                </div>
              ))}
            </div>
            <div className="od-summary">
              <div className="od-summary-row"><span>{t.orderSummary.subtotal}</span><strong>{formatVND(order.pricing.subtotal)}</strong></div>
              <div className="od-summary-row"><span>{t.orderSummary.shippingFee}</span><strong>{formatVND(order.pricing.shipping)}</strong></div>
              <div className="od-summary-row"><span>{t.orderSummary.discount} {order.pricing.voucher && `(${order.pricing.voucher})`}</span><strong>-{formatVND(order.pricing.discount)}</strong></div>
              <div className="od-summary-row od-total"><span>{t.orderSummary.total}</span><strong>{formatVND(total)}</strong></div>
            </div>

            {/* Commission Breakdown - Multi-vendor */}
            {(() => {
              const commissionRate = order.commissionRate ?? 0;
              const hasCommissionRate = order.commissionRate !== null && order.commissionRate !== undefined;
              const commissionData = calculateCommission(total, commissionRate);
              const storeName = order.storeName || 'Chưa xác định';
              
              return (
                <div className="od-commission-card" style={{
                  marginTop: 12,
                  padding: 14,
                  background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
                  border: '1px solid #99f6e4',
                  borderRadius: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Store size={16} style={{ color: '#0d9488' }} />
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0d9488' }}>
                      {MARKETPLACE_DICTIONARY.commission.title}
                    </h3>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#475569' }}>{MARKETPLACE_DICTIONARY.common.store}</span>
                      <strong style={{ color: '#334155' }}>{storeName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Percent size={12} />
                        {MARKETPLACE_DICTIONARY.commission.rate}
                      </span>
                      <strong style={{ color: '#334155' }}>{hasCommissionRate ? `${commissionRate}%` : 'Chưa cấu hình'}</strong>
                    </div>
                    <div style={{ height: 1, background: '#99f6e4', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#475569' }}>{MARKETPLACE_DICTIONARY.commission.fee}</span>
                      <strong style={{ color: '#d97706' }}>-{formatCurrency(commissionData.commission)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: '#475569', fontWeight: 600 }}>{MARKETPLACE_DICTIONARY.commission.payout}</span>
                      <strong style={{ color: '#0d9488', fontSize: 16 }}>{formatCurrency(commissionData.payout)}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="od-section">
            <div className="od-section-head">
              <h2>{t.sections.paymentInfo}</h2>
            </div>
            <div className="od-card">
              <div className="od-card-row"><span className="od-label">{t.paymentInfo.method}</span><strong>{order.paymentMethod}</strong></div>
               <div className="od-card-row"><span className="od-label">{t.paymentInfo.paymentStatus}</span><span className={`admin-pill ${paymentStatus === 'paid' ? 'success' : paymentStatus === 'refund_pending' ? 'error' : 'pending'}`}>{paymentLabel(paymentStatus)}</span></div>
               <div className="od-card-row"><span className="od-label">{t.paymentInfo.shippingStatus}</span><span className={`admin-pill ${fulfillment === 'done' ? 'success' : fulfillment === 'canceled' ? 'error' : 'pending'}`}><Truck size={14} /> {shipLabel(fulfillment)}</span></div>
              <div className="od-card-row tracking-row">
                <span className="od-label">{t.trackingNumber}</span>
                {isEditingTracking ? (
                  <div className="tracking-edit">
                    <input
                      type="text"
                      className="tracking-input"
                      placeholder={t.trackingPlaceholder}
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                    />
                    <button
                      className="admin-icon-btn subtle"
                      aria-label={t.updateTracking}
                      disabled={isUpdatingTracking || !trackingInput.trim()}
                      onClick={saveTrackingNumber}
                    >
                      <Save size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="tracking-value">
                    <strong>{order.tracking || '-'}</strong>
                    <button
                      className="admin-icon-btn subtle"
                      aria-label={ADMIN_DICTIONARY.actionTitles.copyTracking}
                      onClick={() => {
                        if (!order.tracking) {
                          pushToast('Đơn hàng chưa có mã vận đơn để sao chép.');
                          return;
                        }
                        navigator.clipboard?.writeText(order.tracking);
                        pushToast('Đã sao chép mã vận đơn.');
                      }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="admin-icon-btn subtle"
                      aria-label={t.updateTracking}
                      onClick={() => {
                        setTrackingInput(order.tracking || '');
                        setIsEditingTracking(true);
                      }}
                    >
                      <Save size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="od-right">
          <section className="od-section">
            <div className="od-section-head">
              <h2>{t.sections.customerShipping}</h2>
            </div>
            <div className="od-card">
              <div className="od-card-row"><span className="od-label">Khách hàng</span><strong>{order.customerInfo.name}</strong></div>
              <div className="od-card-row"><span className="od-label">Số điện thoại</span><strong>{order.customerInfo.phone}</strong></div>
              <div className="od-card-row"><span className="od-label">Email</span><span>{order.customerInfo.email}</span></div>
              <div className="od-card-row"><span className="od-label">Địa chỉ</span><span>{order.address}</span></div>
              <div className="od-card-row"><span className="od-label">Đơn vị vận chuyển</span><span>{order.shipMethod}</span></div>
              <div className="od-note">Ghi chú khách hàng: {order.note}</div>
            </div>
          </section>

          <section className="od-section">
            <div className="od-section-head">
              <h2>{t.sections.timeline}</h2>
              <button className="admin-ghost-btn" onClick={exportAuditLog}><Download size={14} /> {t.actions.exportAudit}</button>
            </div>
            <div className="od-timeline">
              {timeline.map((log, idx) => (
                <div key={idx} className="od-timeline-item">
                  <div className={`od-timeline-dot ${log.tone || 'neutral'}`} />
                  <div>
                    <p className="od-timeline-time">{log.time}</p>
                    <p className="od-timeline-text">
                      <User size={14} /> {log.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>

      {showTransitionModal && pendingTransition && (
        <>
          <div className="drawer-overlay" onClick={() => { setShowTransitionModal(false); setPendingTransition(null); }} />
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-label="Xác nhận chuyển trạng thái">
            <h3>Xác nhận chuyển trạng thái đơn hàng</h3>
            <p>Bạn đang chuyển từ <strong>{fulfillmentLabel(fulfillment)}</strong> sang <strong>{fulfillmentLabel(pendingTransition)}</strong>.</p>
            <div className="confirm-impact-grid">
              <div>
                <span className="admin-muted small">Trạng thái thanh toán hiện tại</span>
                <p className="admin-bold">{paymentLabel(paymentStatus)}</p>
              </div>
              <div>
                <span className="admin-muted small">Sau khi chuyển trạng thái</span>
                <p className="admin-bold">{paymentLabel(nextPaymentStatusPreview)}</p>
              </div>
            </div>

            {(pendingTransition === 'canceled' || pendingTransition === 'done') && (
              <div className="confirm-reason-block">
                <label className="form-field">
                  <span>Lý do chuyển trạng thái</span>
                  <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as TransitionReasonCode)}>
                    {transitionReasonCatalog[pendingTransition].map((item) => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Ghi chú nội bộ</span>
                  <textarea rows={3} value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder={t.reasonNotePlaceholder} />
                </label>
              </div>
            )}

            {(() => {
              const selectedReason = transitionReasonCatalog[pendingTransition].find((item) => item.code === reasonCode);
              const shouldWarn = (pendingTransition === 'canceled' || pendingTransition === 'done') && (!selectedReason || (selectedReason.requireNote && !reasonNote.trim()));
              return shouldWarn ? <p className="confirm-warning">Cần chọn lý do hợp lệ và nhập ghi chú bắt buộc trước khi xác nhận thao tác này.</p> : null;
            })()}
            <div className="confirm-modal-actions">
              <button className="admin-ghost-btn" onClick={() => { setShowTransitionModal(false); setPendingTransition(null); }}>{t.actions.cancel}</button>
              <button
                className="admin-primary-btn"
                disabled={(() => {
                  if (pendingTransition !== 'canceled' && pendingTransition !== 'done') return false;
                  const selectedReason = transitionReasonCatalog[pendingTransition].find((item) => item.code === reasonCode);
                  if (!selectedReason) return true;
                  if (selectedReason.requireNote && !reasonNote.trim()) return true;
                  return false;
                })()}
                onClick={() => updateFulfillment(pendingTransition)}
              >
                {t.actions.confirmUpdate}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

const AdminOrderDetail = () => {
  const { id } = useParams();
  const orderCode = useMemo(() => (id || '').replace('#', ''), [id]);

  return <AdminOrderDetailContent key={orderCode} orderCode={orderCode} routeId={id} />;
};

export default AdminOrderDetail;
