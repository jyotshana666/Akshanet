import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiTile } from '../components/KpiTile';
import { Users } from 'lucide-react';

describe('KpiTile', () => {
  it('renders label and value', () => {
    render(<KpiTile label="Total Students" value="12,345" icon={Users} color="text-blue-600" />);
    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('renders loading skeleton when loading', () => {
    render(<KpiTile label="Verified" value="85%" icon={Users} color="text-green-600" loading />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('85%')).not.toBeInTheDocument();
  });

  it('renders numeric value directly', () => {
    render(<KpiTile label="Anomalies" value={42} icon={Users} color="text-red-600" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('has correct test id', () => {
    render(<KpiTile label="Pending Approvals" value={7} icon={Users} color="text-amber-600" />);
    expect(screen.getByTestId('kpi-pending-approvals')).toBeInTheDocument();
  });
});
