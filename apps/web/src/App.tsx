import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { InstitutionLayout } from '@/components/layout/InstitutionLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/institution/DashboardPage';
import { UploadPage } from '@/pages/institution/upload/UploadPage';
import { ColumnMapperPage } from '@/pages/institution/upload/ColumnMapperPage';
import { RecordsPage } from '@/pages/institution/RecordsPage';
import { FlagsPage } from '@/pages/institution/FlagsPage';
import { NotifyPage } from '@/pages/institution/NotifyPage';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<InstitutionLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/upload/:id/map" element={<ColumnMapperPage />} />
            <Route path="/submissions/:id/records" element={<RecordsPage />} />
            <Route path="/flags" element={<FlagsPage />} />
            <Route path="/notify" element={<NotifyPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
