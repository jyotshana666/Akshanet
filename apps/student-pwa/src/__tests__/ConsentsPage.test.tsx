import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Riya', apaarId: '543210987654', status: 'VERIFIED', role: 'STUDENT' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import { ConsentsPage } from '../pages/ConsentsPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>
          <ConsentsPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({
    data: [
      {
        id: 'req-1',
        employerName: 'TCS',
        purpose: 'Employment verification',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'PENDING',
      },
      {
        id: 'req-2',
        employerName: 'Infosys',
        purpose: 'Background check',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'APPROVED',
      },
    ],
  });
  mockPatch.mockResolvedValue({ data: { success: true } });
});

describe('ConsentsPage', () => {
  it('renders pending and approved consent requests', async () => {
    renderPage();
    expect(await screen.findByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('Infosys')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('shows approve/deny buttons only for pending requests', async () => {
    renderPage();
    await screen.findByText('TCS');
    expect(screen.getByTestId('approve-req-1')).toBeInTheDocument();
    expect(screen.getByTestId('deny-req-1')).toBeInTheDocument();
    expect(screen.queryByTestId('approve-req-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deny-req-2')).not.toBeInTheDocument();
  });

  it('calls approve API when Approve is clicked', async () => {
    renderPage();
    const btn = await screen.findByTestId('approve-req-1');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/student/consent/req-1', { action: 'approve' });
    });
  });

  it('calls deny API when Deny is clicked', async () => {
    renderPage();
    const btn = await screen.findByTestId('deny-req-1');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/student/consent/req-1', { action: 'deny' });
    });
  });

  it('shows empty state when no requests', async () => {
    mockGet.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('No consent requests at the moment.')).toBeInTheDocument();
  });
});
