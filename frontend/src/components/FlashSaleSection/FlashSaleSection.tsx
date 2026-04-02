import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronLeft, ChevronRight, Store } from 'lucide-react';
import './FlashSaleSection.css';

export interface FlashSaleItem {
  id: string | number;
  backendProductId?: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  storeName: string;
  storeId?: string;
  isOfficialStore?: boolean;
  soldCount: number;
  totalStock: number;
}

interface FlashSaleSectionProps {
  items?: FlashSaleItem[];
  viewAllLink?: string;
  onQuickAdd?: (item: FlashSaleItem) => void;
}

const getRemainingSecondsToEndOfDay = () => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
};

const toTimeParts = (seconds: number) => {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return [
    String(hh).padStart(2, '0'),
    String(mm).padStart(2, '0'),
    String(ss).padStart(2, '0'),
  ];
};

const formatVnd = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')}\u0111`;

const FlashSaleSection = ({
  items = [],
  viewAllLink = '/search?scope=products&sort=discount',
  onQuickAdd,
}: FlashSaleSectionProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(getRemainingSecondsToEndOfDay());
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds(getRemainingSecondsToEndOfDay());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeParts = useMemo(() => toTimeParts(remainingSeconds), [remainingSeconds]);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="flash-sale-section container">
      <div className="flash-sale-header">
        <div className="flash-sale-header-left">
          <h2 className="flash-sale-title">Flash Sale</h2>
          <div className="flash-sale-timer">
            {timeParts.map((part, i) => (
              <div key={`t-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                <span className="flash-sale-timer-digit">{part}</span>
                {i < timeParts.length - 1 && <span className="flash-sale-timer-sep">:</span>}
              </div>
            ))}
          </div>
        </div>
        <Link to={viewAllLink} className="flash-sale-view-all">
          {'Xem t\u1ea5t c\u1ea3'}
        </Link>
      </div>

      <div className="flash-slider-container">
        <button className="flash-slider-nav prev-btn" onClick={scrollLeft} aria-label={'Tr\u01b0\u1edbc'}>
          <ChevronLeft size={24} />
        </button>

        <div className="flash-sale-track" ref={sliderRef}>
          {items.map((item) => {
            const safeStock = Math.max(1, item.totalStock);
            const progress = Math.min(100, Math.round((item.soldCount / safeStock) * 100));
            const discountPercent = item.originalPrice && item.originalPrice > item.price
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0;
            const isAlmostOut = progress > 80;

            return (
              <article key={item.id} className="flash-card">
                <div className="flash-card-image-wrap">
                  <Link to={`/product/${item.id}`} className="flash-card-image-link" style={{ display: 'block' }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="flash-card-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flash-card-no-image">{'Kh\u00f4ng c\u00f3 \u1ea3nh'}</div>
                    )}

                    <span className="flash-badge-type sale">
                      <svg viewBox="0 0 24 24" className="flash-badge-icon" aria-hidden="true">
                        <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
                      </svg>
                      {'Gi\u1ea3m'}
                    </span>

                    {discountPercent > 0 && (
                      <div className="flash-badge-discount">
                        <span className="flash-badge-discount-num">{discountPercent}%</span>
                        <span className="flash-badge-discount-label">{'Gi\u1ea3m'}</span>
                      </div>
                    )}
                  </Link>

                  <button
                    type="button"
                    className="flash-card-quick-add"
                    title={'Th\u00eam v\u00e0o gi\u1ecf'}
                    onClick={() => onQuickAdd?.(item)}
                  >
                    <ShoppingBag size={15} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="flash-card-body">
                  <Link to={`/product/${item.id}`} style={{ display: 'block' }}>
                    <h3 className="flash-card-name">{item.name}</h3>
                  </Link>

                  <div className="flash-card-prices">
                    <span className="flash-card-price-current">{formatVnd(item.price)}</span>
                    {typeof item.originalPrice === 'number' && item.originalPrice > item.price && (
                      <span className="flash-card-price-original">{formatVnd(item.originalPrice)}</span>
                    )}
                  </div>

                  <div className="flash-card-vendor">
                    <Store size={12} />
                    <span className="flash-card-vendor-name">{item.storeName}</span>
                  </div>

                  <div className="flash-progress-wrap">
                    <div
                      className={`flash-progress-fill${isAlmostOut ? ' almost-out' : ''}`}
                      style={{ width: `${progress}%` }}
                    />

                    {isAlmostOut && progress < 100 && (
                      <div className="flash-fire-icon">
                        <svg width="10" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                      </div>
                    )}

                    <span className={`flash-progress-text${progress < 50 ? ' low' : ''}`}>
                      {progress >= 100 ? 'H\u1ebft h\u00e0ng' : `\u0110\u00e3 b\u00e1n ${item.soldCount}`}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button className="flash-slider-nav next-btn" onClick={scrollRight} aria-label="Sau">
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
};

export default FlashSaleSection;
