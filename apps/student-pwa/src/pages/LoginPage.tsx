import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { useToast } from '@/hooks/useToast';

export function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const isPhone = /^\d{10}$/.test(identifier);
  const isApaar = /^\d{12}$/.test(identifier);
  const canSend = isPhone || isApaar;

  const sendOtp = useMutation({
    mutationFn: () => {
      const body = isPhone ? { phone: identifier } : { apaarId: identifier };
      return api.post('/auth/student/send-otp', body);
    },
    onSuccess: () => {
      setOtpSent(true);
      toast({ title: 'OTP sent', description: 'Check your phone for the code.' });
    },
    onError: () => toast({ title: 'Failed to send OTP', variant: 'destructive' }),
  });

  const verify = useMutation({
    mutationFn: () => {
      const body = isPhone ? { phone: identifier, otp } : { apaarId: identifier, otp };
      return api.post('/auth/student/verify-otp', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/home');
    },
    onError: () => toast({ title: 'Invalid OTP', variant: 'destructive' }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-brand to-brand-dark">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-brand text-xl">Akshanet</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Student Portal</p>
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
              <label className="text-sm font-medium text-gray-700">Phone or APAAR ID</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="10-digit phone or 12-digit APAAR ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, ''))}
                maxLength={12}
                disabled={otpSent}
                required
              />
              {identifier.length > 0 && !canSend && (
                <p className="text-xs text-red-500">Enter a 10-digit phone or 12-digit APAAR ID</p>
              )}
            </div>

            {otpSent && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">OTP</label>
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
              className="w-full"
              size="lg"
              disabled={(!otpSent && !canSend) || sendOtp.isPending || verify.isPending}
            >
              {sendOtp.isPending || verify.isPending
                ? 'Please wait...'
                : otpSent
                  ? 'Verify OTP'
                  : 'Send OTP'}
            </Button>

            {otpSent && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setOtpSent(false); setOtp(''); }}
              >
                Change number
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
