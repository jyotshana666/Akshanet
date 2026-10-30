import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToast } from '@/hooks/useToast';
import { CONSENT_PURPOSES } from '@/lib/constants';

interface FormState {
  apaarId: string;
  purpose: string;
  expiryDate: string;
  notes: string;
}

const INITIAL: FormState = { apaarId: '', purpose: '', expiryDate: '', notes: '' };

export function RequestConsentPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { toast } = useToast();

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.apaarId.trim()) errs.apaarId = 'APAAR ID is required';
    else if (!/^\d{12}$/.test(form.apaarId.trim())) errs.apaarId = 'APAAR ID must be 12 digits';
    if (!form.purpose) errs.purpose = 'Purpose is required';
    if (!form.expiryDate) errs.expiryDate = 'Expiry date is required';
    else if (new Date(form.expiryDate) <= new Date()) errs.expiryDate = 'Expiry must be in the future';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = useMutation({
    mutationFn: () => api.post('/employer/consent/request', form),
    onSuccess: () => {
      toast('Consent request sent', 'success');
      setForm(INITIAL);
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['consent'] });
    },
    onError: () => toast('Failed to send request', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) submit.mutate();
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-emp-navy">Request Consent</h2>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">New Consent Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="consent-form">
            <div>
              <Label htmlFor="apaarId">APAAR ID</Label>
              <Input
                id="apaarId"
                value={form.apaarId}
                onChange={(e) => setField('apaarId', e.target.value)}
                placeholder="12-digit APAAR ID"
                maxLength={12}
              />
              {errors.apaarId && <p className="mt-1 text-sm text-red-600" role="alert">{errors.apaarId}</p>}
            </div>

            <div>
              <Label>Purpose</Label>
              <Select value={form.purpose} onValueChange={(v) => setField('purpose', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  {CONSENT_PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.purpose && <p className="mt-1 text-sm text-red-600" role="alert">{errors.purpose}</p>}
            </div>

            <div>
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setField('expiryDate', e.target.value)}
              />
              {errors.expiryDate && <p className="mt-1 text-sm text-red-600" role="alert">{errors.expiryDate}</p>}
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Additional context"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
