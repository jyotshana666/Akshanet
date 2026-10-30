import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        institutions: [
          {
            id: 'inst-1',
            name: 'Saveetha Engineering College',
            aicteId: 'SEC-TN-2019-001',
            region: 'Southern',
            state: 'Tamil Nadu',
            totalRecords: 50,
            verified: 40,
            flagged: 3,
            submittedAt: '2024-09-15T00:00:00Z',
            checklist: {
              apaarCoverage100: false,
              noDuplicates: false,
              noIntakeViolations: true,
              noFraudEscalation: true,
              allStudentsVerified: false,
            },
          },
        ],
        total: 1,
      },
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'AICTE_ADMIN', region: null, name: 'Test' },
    role: 'AICTE_ADMIN',
    region: null,
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import { ApprovalsPage } from '../pages/ApprovalsPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>
          <ApprovalsPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Approval Queue Row Expansion', () => {
  it('renders institution name in the table', async () => {
    renderPage();
    expect(await screen.findByText('Saveetha Engineering College')).toBeInTheDocument();
  });

  it('shows APH checklist on row click', async () => {
    renderPage();
    const row = await screen.findByTestId('approval-row-inst-1');
    fireEvent.click(row);

    const detail = screen.getByTestId('approval-detail-inst-1');
    expect(detail).toBeInTheDocument();
    expect(detail).toHaveTextContent('100% APAAR Coverage');
    expect(detail).toHaveTextContent('No Unresolved Duplicates');
    expect(detail).toHaveTextContent('All Students Verified');
  });

  it('collapses detail on second click', async () => {
    renderPage();
    const row = await screen.findByTestId('approval-row-inst-1');
    fireEvent.click(row);
    expect(screen.getByTestId('approval-detail-inst-1')).toBeInTheDocument();

    fireEvent.click(row);
    expect(screen.queryByTestId('approval-detail-inst-1')).not.toBeInTheDocument();
  });

  it('shows Approve and Reject buttons', async () => {
    renderPage();
    expect(await screen.findByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });
});
