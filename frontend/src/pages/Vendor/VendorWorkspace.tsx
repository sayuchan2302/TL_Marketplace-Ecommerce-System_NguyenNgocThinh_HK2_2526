import { isValidElement, lazy, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import VendorLayout from './VendorLayout';
import { AdminShellContext, type AdminShellState } from '../Admin/AdminShellContext';
import PageFallback from '../../components/Transitions/PageFallback';
import RouteLoader from '../../components/RouteLoader/RouteLoader';

const VendorDashboard = lazy(() => import('./VendorDashboard'));
const VendorOrders = lazy(() => import('./VendorOrders'));
const VendorOrderDetail = lazy(() => import('./VendorOrderDetail'));
const VendorProducts = lazy(() => import('./VendorProducts'));
const VendorStorefront = lazy(() => import('./VendorStorefront'));
const VendorPromotions = lazy(() => import('./VendorPromotions'));
const VendorReviews = lazy(() => import('./VendorReviews'));
const VendorReturnDashboard = lazy(() => import('./VendorReturnDashboard'));

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

const VendorWorkspace = () => {
  const [shellState, setShellState] = useState<AdminShellState>(defaultShellState);

  const handleShellState = useCallback((nextState: AdminShellState) => {
    setShellState((current) => (areShellStatesEqual(current, nextState) ? current : nextState));
  }, []);

  return (
    <AdminShellContext.Provider value={handleShellState}>
      <VendorLayout
        title={shellState.title}
        actions={shellState.actions}
        hideTopbarTitle={shellState.hideTopbarTitle}
        breadcrumbs={shellState.breadcrumbs}
      >
        <div className="admin-route-transition">
          <RouteLoader fallback={<PageFallback />}>
            <Routes>
              <Route index element={<Navigate to="/vendor/dashboard" replace />} />
              <Route path="dashboard" element={<VendorDashboard />} />
              <Route path="orders" element={<VendorOrders />} />
              <Route path="orders/:id" element={<VendorOrderDetail />} />
              <Route path="returns" element={<VendorReturnDashboard />} />
              <Route path="products" element={<VendorProducts />} />
              <Route path="storefront" element={<VendorStorefront />} />
              <Route path="promotions" element={<VendorPromotions />} />
              <Route path="reviews" element={<VendorReviews />} />
              <Route path="analytics" element={<Navigate to="/vendor/dashboard#analytics" replace />} />
              <Route path="settings" element={<Navigate to="/vendor/storefront" replace />} />
              <Route path="*" element={<Navigate to="/vendor/dashboard" replace />} />
            </Routes>
          </RouteLoader>
        </div>
      </VendorLayout>
    </AdminShellContext.Provider>
  );
};

export default VendorWorkspace;
