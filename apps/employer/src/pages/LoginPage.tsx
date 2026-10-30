import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';

export function LoginPage() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const sendOtp = useMutation({
    mutationFn: () => api.post('/auth/employer/send-otp', { email }),
    onSuccess: () => {
      setStep('otp');
      toast('OTP sent to your email', 'success');
    },
    onError: () => toast('Failed to send OTP', 'error'),
  });

  const verifyOtp = useMutation({
    mutationFn: () => api.post('/auth/employer/verify-otp', { email, otp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/dashboard');
    },
    onError: () => toast('Invalid OTP', 'error'),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-emp-navy">Employer Login</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendOtp.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={sendOtp.isPending}>
                {sendOtp.isPending ? 'Sending…' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyOtp.mutate();
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">OTP sent to {email}</p>
              <div>
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="6-digit code"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifyOtp.isPending}>
                {verifyOtp.isPending ? 'Verifying…' : 'Verify'}
              </Button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-center text-sm text-muted-foreground hover:underline"
              >
                Use a different email
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
