import { isValidElement, Suspense, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Admin from './Admin';
import AdminOrders from './AdminOrders';
import AdminOrderDetail from './AdminOrderDetail';
import AdminCategories from './AdminCategories';
import AdminUsers from './AdminUsers';
import AdminPromotions from './AdminPromotions';
import AdminReviews from './AdminReviews';
import StoreApprovals from './StoreApprovals';
import AdminFinancials from './AdminFinancials';
import AdminBotAI from './AdminBotAI';
import AdminReturns from './AdminReturns';
import AdminProductGovernance from './AdminProductGovernance';
import { AdminShellContext, type AdminShellState } from './AdminShellContext';
import { AdminMountedContext } from './useAdminPageAnimation';
import AdminLayout from './AdminLayout';
import PageFallback from '../../components/Transitions/PageFallback';

const defaultShellState: AdminShellState = {
  title: 'Tổng quan',
};

const isPrimitiveNode = (value: ReactNode) =>
  value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const areReactNodesEqual = (left: ReactNode, right: ReactNode): boolean => {
  if (Object.is(left, right)) return true;

  if (isPrimitiveNode(left) || isPrimitiveNode(right)) {
    return Object.is(left, right);
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => areReactNodesEqual(item, right[index]));
  }

  if (isValidElement(left) && isValidElement(right)) {
    if (left.type !== right.type || left.key !== right.key) return false;

    const leftProps = left.props as Record<string, unknown>;
    const rightProps = right.props as Record<string, unknown>;
    const propKeys = new Set([...Object.keys(leftProps), ...Object.keys(rightProps)]);

    for (const key of propKeys) {
      const leftValue = leftProps[key];
      const rightValue = rightProps[key];

      if (typeof leftValue === 'function' && typeof rightValue === 'function') {
        continue;
      }

      if (key === 'children') {
        if (!areReactNodesEqual(leftValue as ReactNode, rightValue as ReactNode)) {
          return false;
        }
        continue;
      }

      if (isPlainObject(leftValue) || isPlainObject(rightValue)) {
        if (!isPlainObject(leftValue) || !isPlainObject(rightValue)) return false;

        const nestedKeys = new Set([...Object.keys(leftValue), ...Object.keys(rightValue)]);
        for (const nestedKey of nestedKeys) {
          if (!Object.is(leftValue[nestedKey], rightValue[nestedKey])) {
            return false;
          }
        }
        continue;
      }

      if (!Object.is(leftValue, rightValue)) {
        return false;
      }
    }

    return true;
  }

  return false;
};

const areShellStatesEqual = (left: AdminShellState, right: AdminShellState) =>
  left.hideTopbarTitle === right.hideTopbarTitle &&
  areReactNodesEqual(left.title, right.title) &&
  areReactNodesEqual(left.actions, right.actions) &&
  (left.breadcrumbs?.length || 0) === (right.breadcrumbs?.length || 0) &&
  (left.breadcrumbs || []).every((crumb, index) => crumb === right.breadcrumbs?.[index]);

const AdminWorkspace = () => {
  const [shellState, setShellState] = useState<AdminShellState>(defaultShellState);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleShellState = useCallback((nextState: AdminShellState) => {
    setShellState((current) => (areShellStatesEqual(current, nextState) ? current : nextState));
  }, []);

  return (
    <AdminShellContext.Provider value={handleShellState}>
      <AdminLayout
        title={shellState.title}
        actions={shellState.actions}
        hideTopbarTitle={shellState.hideTopbarTitle}
        breadcrumbs={shellState.breadcrumbs}
      >
        <AdminMountedContext.Provider value={isMounted}>
          <div className="admin-route-transition">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Admin />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="orders/:id" element={<AdminOrderDetail />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="promotions" element={<AdminPromotions />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="stores" element={<StoreApprovals />} />
                <Route path="product-governance" element={<AdminProductGovernance />} />
                <Route path="financials" element={<AdminFinancials />} />
                <Route path="bot-ai" element={<AdminBotAI />} />
                <Route path="returns" element={<AdminReturns />} />

                <Route path="products" element={<Navigate to="/admin/categories" replace />} />
                <Route path="customers" element={<Navigate to="/admin/users" replace />} />
                <Route path="customer" element={<Navigate to="/admin/users" replace />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </AdminMountedContext.Provider>
      </AdminLayout>
    </AdminShellContext.Provider>
  );
};

export default AdminWorkspace;
