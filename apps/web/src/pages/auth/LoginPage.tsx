import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';

export function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = useMutation({
    mutationFn: () => api.post('/auth/institution/send-otp', { email }),
    onSuccess: () => {
      setOtpSent(true);
      toast({ title: 'OTP sent', description: 'Check your email for the verification code.' });
    },
    onError: () => {
      toast({ title: 'Failed to send OTP', variant: 'destructive' });
    },
  });

  const verifyOtp = useMutation({
    mutationFn: () => api.post('/auth/institution/verify-otp', { email, otp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/dashboard');
    },
    onError: () => {
      toast({ title: 'Invalid OTP', description: 'Please check the code and try again.', variant: 'destructive' });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Akshanet</CardTitle>
          <CardDescription>Institution Portal — Sign in with OTP</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!otpSent) sendOtp.mutate();
              else verifyOtp.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpSent}
                required
              />
            </div>

            {otpSent && (
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
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
              className="w-full"
              disabled={sendOtp.isPending || verifyOtp.isPending}
            >
              {sendOtp.isPending || verifyOtp.isPending
                ? 'Please wait...'
                : otpSent
                  ? 'Verify'
                  : 'Send OTP'}
            </Button>

            {otpSent && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                }}
              >
                Use a different email
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
