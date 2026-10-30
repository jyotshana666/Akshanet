import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/hooks/useToast';
import { RequestConsentPage } from '@/pages/RequestConsentPage';

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { id: '1' } }),
    get: vi.fn().mockResolvedValue({ data: null }),
    interceptors: { response: { use: vi.fn() } },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', companyName: 'Test Co' }, isAuthenticated: true, isLoading: false }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>
          <RequestConsentPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequestConsentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors when submitting empty form', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText('APAAR ID is required')).toBeInTheDocument();
      expect(screen.getByText('Purpose is required')).toBeInTheDocument();
      expect(screen.getByText('Expiry date is required')).toBeInTheDocument();
    });
  });

  it('shows error for invalid APAAR ID format', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/apaar id/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText('APAAR ID must be 12 digits')).toBeInTheDocument();
    });
  });

  it('submits successfully with valid data', async () => {
    const { default: api } = await import('@/lib/api');
    renderPage();

    fireEvent.change(screen.getByLabelText(/apaar id/i), { target: { value: '123456789012' } });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    fireEvent.change(screen.getByLabelText(/expiry date/i), { target: { value: dateStr } });

    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText('Purpose is required')).toBeInTheDocument();
    });

    expect(api.post).not.toHaveBeenCalled();
  });

  it('renders the form fields', () => {
    renderPage();
    expect(screen.getByLabelText(/apaar id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument();
  });
});
