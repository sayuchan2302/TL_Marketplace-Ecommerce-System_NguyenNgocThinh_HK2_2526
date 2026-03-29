import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import './Returns.css';
import { useToast } from '../../contexts/ToastContext';
import { CLIENT_TEXT } from '../../utils/texts';
import { apiRequest } from '../../services/apiClient';
import { returnService, type ReturnResolution, type ReturnReason } from '../../services/returnService';
import { toDisplayOrderCode, toDisplayReturnCode } from '../../utils/displayCode';

const t = CLIENT_TEXT.returns;

interface BackendOrderItem {
  id: string;
  productName?: string;
  variantName?: string;
  productImage?: string;
  quantity?: number;
}

interface BackendOrder {
  id: string;
  code?: string;
  items?: BackendOrderItem[];
}

type SelectableItem = BackendOrderItem & { selected: boolean };

const Returns = () => {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [items, setItems] = useState<SelectableItem[]>([]);
  const [reason, setReason] = useState<ReturnReason>('SIZE');
  const [resolution, setResolution] = useState<ReturnResolution>('EXCHANGE');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await apiRequest<BackendOrder[]>('/api/orders', {}, { auth: true });
        setOrders(data);
        if (data.length > 0) {
          setSelectedOrderId(data[0].id);
          setItems((data[0].items || []).map((item) => ({ ...item, selected: false })));
        }
      } catch {
        addToast('Không tải được đơn hàng để tạo yêu cầu đổi trả', 'error');
      }
    };
    void loadOrders();
  }, [addToast]);

  useEffect(() => {
    const order = orders.find((entry) => entry.id === selectedOrderId);
    setItems((order?.items || []).map((item) => ({ ...item, selected: false })));
  }, [selectedOrderId, orders]);

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const selectedItems = useMemo(() => items.filter((item) => item.selected), [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      addToast('Vui lòng chọn đơn hàng', 'error');
      return;
    }
    if (selectedItems.length === 0) {
      addToast(t.validation.selectOne, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await returnService.submit({
        orderId: selectedOrderId,
        reason,
        note: note.trim(),
        resolution,
        items: selectedItems.map((item) => ({ orderItemId: item.id, quantity: item.quantity || 1 })),
      });
      setSubmittedCode(toDisplayReturnCode(res.code || res.id));
      addToast(t.submitted, 'success');
      setNote('');
      setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
    } catch {
      addToast('Tạo yêu cầu đổi trả thất bại', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="returns-page">
      <div className="returns-container">
        <div className="returns-hero">
          <div>
            <p className="hero-kicker">{t.hero.kicker}</p>
            <h1 className="hero-title">{t.hero.title}</h1>
            <p className="hero-sub">{t.hero.subtitle}</p>
          </div>
          <div className="hero-icon"><RefreshCw size={42} /></div>
        </div>

        <form className="returns-grid" onSubmit={handleSubmit}>
          <div className="returns-card">
            <h3>{t.product.title}</h3>

            <label className="returns-field">
              <span>Chọn đơn hàng</span>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="returns-select"
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{toDisplayOrderCode(order.code || order.id)}</option>
                ))}
              </select>
            </label>

            <div className="returns-items">
              {items.map((item) => (
                <label key={item.id} className={`returns-item ${item.selected ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItem(item.id)}
                  />
                  {item.productImage && <img src={item.productImage} alt={item.productName} />}
                  <div className="item-info">
                    <p className="item-name">{item.productName}</p>
                    <p className="item-variant">{item.variantName}</p>
                    <p className="item-price">Số lượng: {item.quantity || 1}</p>
                  </div>
                </label>
              ))}
              {items.length === 0 && <p className="returns-empty">Không tìm thấy sản phẩm trong đơn hàng.</p>}
            </div>
          </div>

          <div className="returns-card">
            <h3>{t.info.title}</h3>
            <div className="form-stack">
              <div>
                <label>{t.info.reason}</label>
                <div className="reason-grid">
                  {[
                    { id: 'SIZE' as ReturnReason, label: t.info.reasons.size },
                    { id: 'DEFECT' as ReturnReason, label: t.info.reasons.defect },
                    { id: 'CHANGE' as ReturnReason, label: t.info.reasons.change },
                    { id: 'OTHER' as ReturnReason, label: t.info.reasons.other },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`reason-chip ${reason === opt.id ? 'active' : ''}`}
                      onClick={() => setReason(opt.id)}
                    >
                      {reason === opt.id && <Check size={14} />} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>{t.info.description}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.info.descriptionPlaceholder}
                />
              </div>

              <div>
                <label>{t.resolution.title}</label>
                <div className="reason-grid">
                  {[
                    { id: 'EXCHANGE' as ReturnResolution, label: t.resolution.changeSize },
                    { id: 'REFUND' as ReturnResolution, label: t.resolution.refund },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`reason-chip ${resolution === opt.id ? 'active' : ''}`}
                      onClick={() => setResolution(opt.id)}
                    >
                      {resolution === opt.id && <Check size={14} />} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="returns-actions">
              <button type="submit" className="returns-submit" disabled={submitting}>
                {submitting ? t.summary.submitting : t.summary.submit}
              </button>
              {submittedCode && <p className="returns-success">Đã gửi yêu cầu #{submittedCode}</p>}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Returns;
