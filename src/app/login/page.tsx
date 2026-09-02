'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { app } from '@/lib/firebase';
import { LogIn, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoginLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailInput, password);
      
      // Fetch profile to determine role for routing
      const { getUserProfile } = await import('@/lib/firebaseService');
      const profile = await getUserProfile(userCredential.user.uid) as any;
      
      toast({ title: 'Login Successful' });
      
      if (profile?.role === 'admin' || emailInput === 'tcedocs2025@gmail.com') {
        router.push('/admin');
      } else {
        router.push('/status');
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Please check your credentials and try again.',
      });
    } finally {
      setLoginLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      
      toast({
        title: 'Password Reset Email Sent',
        description: 'Check your email for password reset instructions.',
      });
      
      setForgotPasswordOpen(false);
      setResetEmail('');
    } catch (err: any) {
      console.error('Password reset error:', err);
      toast({
        variant: 'destructive',
        title: 'Password Reset Failed',
        description: 'Failed to send password reset email. Please try again.',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={loginLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={togglePasswordVisibility}
                  disabled={loginLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loginLoading}>
              {loginLoading ? 'Logging in...' : <><LogIn className="mr-2 h-4 w-4" /> Login</>}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
              <DialogTrigger asChild>
                <Button variant="link" className="text-sm text-muted-foreground hover:text-primary">
                  <KeyRound className="mr-1 h-3 w-3" />
                  Forgot Password?
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Reset Password</DialogTitle>
                  <DialogDescription>
                    Enter your email to receive a password reset link.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">Email</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="mail@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setForgotPasswordOpen(false)}
                      className="flex-1"
                      disabled={resetLoading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={resetLoading}
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Email'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
