import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { EmployerLayout } from '@/components/layout/EmployerLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentSearchPage } from '@/pages/StudentSearchPage';
import { RequestConsentPage } from '@/pages/RequestConsentPage';
import { ConsentHistoryPage } from '@/pages/ConsentHistoryPage';
import { AuditLogPage } from '@/pages/AuditLogPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<EmployerLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/search" element={<StudentSearchPage />} />
          <Route path="/request-consent" element={<RequestConsentPage />} />
          <Route path="/consent-history" element={<ConsentHistoryPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
