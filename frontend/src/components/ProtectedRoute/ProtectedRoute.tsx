import { Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { Shield, AlertCircle } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { storeService } from '../../services/storeService';
import type { UserRole } from '../../types/auth';

type AnimationPreset = 'fade' | 'slide' | 'scale' | 'none';

interface ProtectedRouteProps {
  children: ReactElement;
  allowedRoles?: UserRole[];
  requireVendorApproval?: boolean;
  animation?: AnimationPreset;
  fallbackPath?: string;
  showUnauthorized?: boolean;
  redirectUnauthenticatedToLogin?: boolean;
  redirectUnauthorizedToLogin?: boolean;
}

interface UnauthenticatedFallbackProps {
  from: string;
}

const UnauthenticatedFallback = ({ from }: UnauthenticatedFallbackProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
  >
    <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
      <Shield className="w-8 h-8 text-neutral-400" strokeWidth={1.5} />
    </div>
    <div className="text-center">
      <h2 className="text-lg font-medium text-neutral-900">Yêu cầu đăng nhập</h2>
      <p className="text-sm text-neutral-500 mt-1">Vui lòng đăng nhập để tiếp tục</p>
    </div>
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        window.location.href = `/login?redirect=${encodeURIComponent(from)}`;
      }}
      className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
    >
      Đăng nhập ngay
    </motion.button>
  </motion.div>
);

interface UnauthorizedFallbackProps {
  requiredRole: UserRole;
  currentRole?: UserRole;
}

type VendorGuardReason = 'inactive_store' | 'suspended_store' | 'store_unavailable';

interface VendorGuardState {
  isChecking: boolean;
  reason: VendorGuardReason | null;
}

const UnauthorizedFallback = ({ requiredRole, currentRole }: UnauthorizedFallbackProps) => {
  const roleLabels: Record<UserRole, string> = {
    CUSTOMER: 'Khách hàng',
    VENDOR: 'Người bán',
    SUPER_ADMIN: 'Quản trị viên',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4"
    >
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
      </div>
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-medium text-neutral-900">Không có quyền truy cập</h2>
        <p className="text-sm text-neutral-500 mt-1">
          {currentRole
            ? `Bạn đang đăng nhập với tài khoản "${roleLabels[currentRole]}".`
            : 'Bạn không có quyền truy cập trang này.'}
        </p>
        {requiredRole === 'VENDOR' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              window.location.href = '/vendor/register';
            }}
            className="mt-4 px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
          >
            Đăng ký kênh người bán
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

const animationVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

const transitionConfig: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

const ProtectedRoute = ({
  children,
  allowedRoles,
  requireVendorApproval = false,
  animation = 'fade',
  fallbackPath,
  showUnauthorized = true,
  redirectUnauthenticatedToLogin = false,
  redirectUnauthorizedToLogin = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, token } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const [vendorGuard, setVendorGuard] = useState<VendorGuardState>({
    isChecking: false,
    reason: null,
  });

  useEffect(() => {
    if (!requireVendorApproval || !isAuthenticated || user?.role !== 'VENDOR' || !user.isApprovedVendor) {
      return;
    }

    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setVendorGuard({ isChecking: true, reason: null });
    });

    void storeService.getMyStore()
      .then((store) => {
        if (!mounted) return;
        if (store.approvalStatus !== 'APPROVED') {
          setVendorGuard({ isChecking: false, reason: 'store_unavailable' });
          return;
        }
        if (store.status === 'SUSPENDED') {
          setVendorGuard({ isChecking: false, reason: 'suspended_store' });
          return;
        }
        if (store.status !== 'ACTIVE') {
          setVendorGuard({ isChecking: false, reason: 'inactive_store' });
          return;
        }
        setVendorGuard({ isChecking: false, reason: null });
      })
      .catch(() => {
        if (!mounted) return;
        setVendorGuard({ isChecking: false, reason: 'store_unavailable' });
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, requireVendorApproval, user?.isApprovedVendor, user?.role]);

  const redirectToLogin = (reason = 'session-expired') => (
    <Navigate to={`/login?reason=${encodeURIComponent(reason)}&redirect=${encodeURIComponent(currentPath)}`} replace />
  );

  if (!isAuthenticated) {
    if (redirectUnauthenticatedToLogin) {
      return redirectToLogin('unauthorized');
    }
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace state={{ from: currentPath }} />;
    }
    return <UnauthenticatedFallback from={currentPath} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      if (redirectUnauthorizedToLogin) {
        authService.logout('unauthorized');
        authService.adminLogout('unauthorized');
        return redirectToLogin('unauthorized');
      }
      if (fallbackPath) {
        return <Navigate to={fallbackPath} replace />;
      }
      if (showUnauthorized) {
        return <UnauthorizedFallback requiredRole={allowedRoles[0]} currentRole={userRole} />;
      }
      return null;
    }
  }

  const requiresBackendJwt =
    Boolean(allowedRoles?.includes('VENDOR')) || Boolean(allowedRoles?.includes('SUPER_ADMIN'));

  if (requiresBackendJwt) {
    const invalidJwt = !authService.isBackendJwtToken(token) || authService.isJwtExpired(token);
    if (invalidJwt) {
      authService.logout('session-expired');
      authService.adminLogout('session-expired');
      return redirectToLogin('session-expired');
    }
  }

  if (requireVendorApproval && user?.role === 'VENDOR') {
    if (!user.isApprovedVendor) {
      if (fallbackPath) {
        return <Navigate to={fallbackPath} replace />;
      }
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4"
        >
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-medium text-neutral-900">Cửa hàng chờ phê duyệt</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Cửa hàng của bạn đang chờ quản trị viên phê duyệt. Vui lòng chờ trong giây lát.
            </p>
          </div>
        </motion.div>
      );
    }

    if (vendorGuard.isChecking) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4"
        >
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
            <Shield className="w-8 h-8 text-neutral-400" strokeWidth={1.5} />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-medium text-neutral-900">Đang xác minh cửa hàng</h2>
            <p className="text-sm text-neutral-500 mt-1">Hệ thống đang kiểm tra trạng thái hoạt động của cửa hàng.</p>
          </div>
        </motion.div>
      );
    }

    if (vendorGuard.reason) {
      if (fallbackPath) {
        return <Navigate to={fallbackPath} replace />;
      }

      const titleByReason: Record<VendorGuardReason, string> = {
        inactive_store: 'Cửa hàng tạm ngừng hoạt động',
        suspended_store: 'Cửa hàng đang bị tạm khóa',
        store_unavailable: 'Không thể xác minh trạng thái cửa hàng',
      };

      const descriptionByReason: Record<VendorGuardReason, string> = {
        inactive_store: 'Store đang ở trạng thái INACTIVE. Vui lòng liên hệ quản trị viên để kích hoạt lại.',
        suspended_store: 'Store đang ở trạng thái SUSPENDED. Vui lòng liên hệ quản trị viên để được mở khóa.',
        store_unavailable: 'Không thể tải thông tin store hiện tại. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4"
        >
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-medium text-neutral-900">{titleByReason[vendorGuard.reason]}</h2>
            <p className="text-sm text-neutral-500 mt-1">{descriptionByReason[vendorGuard.reason]}</p>
          </div>
        </motion.div>
      );
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={animationVariants[animation]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transitionConfig}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default ProtectedRoute;

export type { ProtectedRouteProps, AnimationPreset };
