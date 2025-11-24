import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    const { error: resetError } = await resetPassword(email);
    
    if (resetError) {
      // Provide more helpful error messages
      let errorMessage = 'Failed to send reset email';
      
      if (resetError.message) {
        errorMessage = resetError.message;
      } else if (resetError.status === 500) {
        errorMessage = 'Server error. Please check your SMTP configuration in Supabase Dashboard.';
      } else if (resetError.status === 429) {
        errorMessage = 'Too many requests. Please wait a few minutes before trying again.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } else {
      setSent(true);
      toast.success('Password reset email sent! Please check your inbox.');
    }
    
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Logo className="h-12 w-auto" />
            </div>
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Check Your Email</CardTitle>
              <CardDescription>We've sent a password reset link to {email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>
              <p className="text-sm text-muted-foreground">
                If you don't see the email, check your spam folder.
              </p>
            </div>
            <div className="text-center space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
              >
                Send Another Email
              </Button>
              <Link to="/login" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo className="h-12 w-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={error ? "border-destructive pl-9" : "pl-9"}
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

