import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { Skeleton } from '@/components/Skeleton';

interface StudentRecord {
  name: string;
  dateOfBirth: string;
  gender: string;
  apaarId: string;
  programme: string;
  programmeCode: string;
  institution: string;
  academicYear: string;
  seatType: string;
  quotaType: string;
  verificationStatus: string;
  apaarValidatedAt: string | null;
  riskScore: number | null;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-right max-w-[55%] truncate">{value ?? '—'}</span>
    </div>
  );
}

export function RecordPage() {
  const { data, isLoading } = useQuery<StudentRecord>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const res = await api.get('/student/me');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (!data) return <p className="text-center text-gray-500 mt-8">No record found.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My Record</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Personal Details</CardTitle>
            <StatusPill status={data.verificationStatus === 'student_verified' || data.verificationStatus === 'aicte_approved' ? 'VERIFIED' : 'PENDING'} />
          </div>
        </CardHeader>
        <CardContent>
          <Field label="Name" value={data.name} />
          <Field label="Date of Birth" value={data.dateOfBirth} />
          <Field label="Gender" value={data.gender} />
          <Field label="APAAR ID" value={data.apaarId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Academic Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Programme" value={data.programme} />
          <Field label="Programme Code" value={data.programmeCode} />
          <Field label="Institution" value={data.institution} />
          <Field label="Academic Year" value={data.academicYear} />
          <Field label="Seat Type" value={data.seatType} />
          <Field label="Quota" value={data.quotaType} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Status" value={data.verificationStatus.replace(/_/g, ' ')} />
          <Field label="APAAR Validated" value={data.apaarValidatedAt ? new Date(data.apaarValidatedAt).toLocaleDateString() : null} />
          <Field label="Risk Score" value={data.riskScore != null ? data.riskScore.toFixed(2) : null} />
        </CardContent>
      </Card>
    </div>
  );
}
