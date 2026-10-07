import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import MenuPage from './pages/MenuPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import InvoicesPage from './pages/InvoicesPage';
import ReturnsPage from './pages/ReturnsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import BillDeletionsPage from './pages/BillDeletionsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="text-neutral-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  if (!user || !allowedRoles.includes(userRole)) {
    return <Navigate to="/pos" replace />;
  }
  return <>{children}</>;
}

function HomeRoute() {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  if (userRole === 'CASHIER') {
    return <POSPage />;
  }
  return <MenuPage />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="text-neutral-500 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRoute />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route
          path="products"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <ProductsPage />
            </RoleRoute>
          }
        />
        <Route
          path="invoices"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <InvoicesPage />
            </RoleRoute>
          }
        />
        <Route
          path="bill-deletions"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <BillDeletionsPage />
            </RoleRoute>
          }
        />
        <Route
          path="returns"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <ReturnsPage />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="users"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route
          path="settings"
          element={
            <RoleRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <SettingsPage />
            </RoleRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  );
}
