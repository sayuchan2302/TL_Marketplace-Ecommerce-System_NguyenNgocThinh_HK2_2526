import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BadgeCheck, MessageCircle, Users, Star, ChevronRight, Store as StoreIcon } from 'lucide-react';
import { hasBackendJwt } from '../../services/apiClient';
import { storeService } from '../../services/storeService';
import { storeFollowService } from '../../services/storeFollowService';
import './StoreInfoCard.css';

export interface StoreInfoCardProps {
  storeId?: string;
  storeName: string;
  storeSlug: string;
  storeLogo?: string;
  isOfficialStore?: boolean;
}

const buildLoginRedirectTarget = () => {
  if (typeof window === 'undefined') return '/login';
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?reason=${encodeURIComponent('auth-required')}&redirect=${encodeURIComponent(current)}`;
};

const formatStatValue = (value: number | null, fallback = '--') => {
  if (value === null || Number.isNaN(value)) return fallback;
  return value.toLocaleString('vi-VN');
};

const StoreInfoCard = ({
  storeId,
  storeName,
  storeSlug,
  storeLogo,
  isOfficialStore = false,
}: StoreInfoCardProps) => {
  const storeUrl = `/store/${storeSlug}`;
  const [rating, setRating] = useState<number | null>(null);
  const [responseRate, setResponseRate] = useState<number | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followSubmitting, setFollowSubmitting] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setRating(null);
      setResponseRate(null);
      setFollowerCount(0);
      setIsFollowing(false);
      return;
    }

    let mounted = true;
    const loadStoreData = async () => {
      try {
        const [storeMeta, followerMeta] = await Promise.all([
          storeService.getStoreById(storeId).catch(() => null),
          storeFollowService.getFollowerCount(storeId).catch(() => ({
            storeId,
            followerCount: 0,
            followedByCurrentUser: false,
          })),
        ]);

        if (!mounted) {
          return;
        }

        setRating(typeof storeMeta?.rating === 'number' ? storeMeta.rating : null);
        setResponseRate(typeof storeMeta?.responseRate === 'number' ? storeMeta.responseRate : null);
        setFollowerCount(Math.max(0, Number(followerMeta.followerCount || 0)));
        setIsFollowing(Boolean(followerMeta.followedByCurrentUser));

        if (hasBackendJwt()) {
          try {
            const followStatus = await storeFollowService.getFollowStatus(storeId);
            if (!mounted) {
              return;
            }
            setFollowerCount(Math.max(0, Number(followStatus.followerCount || 0)));
            setIsFollowing(Boolean(followStatus.followedByCurrentUser));
          } catch {
            // Keep degraded state when follow status API is unavailable.
          }
        }
      } catch {
        if (!mounted) {
          return;
        }
        setRating(null);
        setResponseRate(null);
        setFollowerCount(0);
        setIsFollowing(false);
      }
    };

    void loadStoreData();

    return () => {
      mounted = false;
    };
  }, [storeId]);

  const handleToggleFollow = async () => {
    if (!storeId || followSubmitting) {
      return;
    }

    if (!hasBackendJwt()) {
      if (typeof window !== 'undefined') {
        window.location.href = buildLoginRedirectTarget();
      }
      return;
    }

    setFollowSubmitting(true);
    try {
      const nextState = isFollowing
        ? await storeFollowService.unfollow(storeId)
        : await storeFollowService.follow(storeId);

      setFollowerCount(Math.max(0, Number(nextState.followerCount || 0)));
      setIsFollowing(Boolean(nextState.followedByCurrentUser));
    } finally {
      setFollowSubmitting(false);
    }
  };

  return (
    <div className="store-info-card">
      <div className="store-info-header">
        <div className="store-info-brand">
          {storeLogo ? (
            <img src={storeLogo} alt={storeName} className="store-info-logo" />
          ) : (
            <div className="store-info-logo-placeholder">
              <StoreIcon size={20} strokeWidth={1.5} />
            </div>
          )}
          <div className="store-info-meta">
            <Link to={storeUrl} className="store-info-name">
              {storeName}
              {isOfficialStore && (
                <span className="store-info-official">
                  <BadgeCheck size={14} />
                  Chính hãng
                </span>
              )}
            </Link>
            <span className="store-info-slug">/store/{storeSlug}</span>
          </div>
        </div>

        <div className="store-info-actions">
          {storeId && (
            <button
              type="button"
              className={`store-info-follow-btn ${isFollowing ? 'is-following' : ''}`}
              onClick={() => void handleToggleFollow()}
              disabled={followSubmitting}
            >
              {followSubmitting ? 'Đang xử lý...' : isFollowing ? 'Đã theo dõi' : 'Theo dõi'}
            </button>
          )}

          <motion.div
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Link to={storeUrl} className="store-info-visit-btn">
              Xem gian hàng
              <ChevronRight size={16} />
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="store-info-stats">
        <div className="store-info-stat">
          <Star size={15} className="store-info-stat-icon star" />
          <span className="store-info-stat-value">
            {rating === null ? '--' : rating.toFixed(1)}
          </span>
          <span className="store-info-stat-label">Đánh giá</span>
        </div>
        <div className="store-info-divider" />
        <div className="store-info-stat">
          <MessageCircle size={15} className="store-info-stat-icon response" />
          <span className="store-info-stat-value">
            {responseRate === null ? '--' : `${Math.round(responseRate)}%`}
          </span>
          <span className="store-info-stat-label">Phản hồi</span>
        </div>
        <div className="store-info-divider" />
        <div className="store-info-stat">
          <Users size={15} className="store-info-stat-icon followers" />
          <span className="store-info-stat-value">{formatStatValue(followerCount, '0')}</span>
          <span className="store-info-stat-label">Theo dõi</span>
        </div>
      </div>
    </div>
  );
};

export default StoreInfoCard;
