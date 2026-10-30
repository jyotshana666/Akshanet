import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AicteLayout } from '@/components/layout/AicteLayout';
import { LoginPage } from '@/pages/LoginPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { AnomaliesPage } from '@/pages/AnomaliesPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { LettersPage } from '@/pages/LettersPage';
import { ReportsPage } from '@/pages/ReportsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AicteLayout />}>
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/letters" element={<LettersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
