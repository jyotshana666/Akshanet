import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';

export function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = useMutation({
    mutationFn: () => api.post('/auth/aicte/send-otp', { email }),
    onSuccess: () => {
      setOtpSent(true);
      toast({ title: 'OTP sent', description: 'Check your email for the code.' });
    },
    onError: () => toast({ title: 'Failed to send OTP', variant: 'destructive' }),
  });

  const verify = useMutation({
    mutationFn: () => api.post('/auth/aicte/verify-otp', { email, otp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/overview');
    },
    onError: () => toast({ title: 'Invalid OTP', variant: 'destructive' }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-aicte-navy">AICTE Officer Portal</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Sign in with OTP verification</p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!otpSent) sendOtp.mutate();
              else verify.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="officer@aicte.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpSent}
                required
              />
            </div>
            {otpSent && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Verification Code</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-aicte-navy hover:bg-aicte-navy/90"
              disabled={sendOtp.isPending || verify.isPending}
            >
              {sendOtp.isPending || verify.isPending ? 'Please wait...' : otpSent ? 'Verify' : 'Send OTP'}
            </Button>
            {otpSent && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setOtpSent(false); setOtp(''); }}>
                Use a different email
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
