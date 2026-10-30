import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MobileLayout } from '@/components/MobileLayout';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { RecordPage } from '@/pages/RecordPage';
import { ConsentsPage } from '@/pages/ConsentsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { CertificatePage } from '@/pages/CertificatePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MobileLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/consents" element={<ConsentsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/certificate" element={<CertificatePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
