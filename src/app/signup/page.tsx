'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { app } from '@/lib/firebase';
import { createUserProfile } from '@/lib/firebaseService';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const CATEGORIES = [
  "TMills",
  "VTM",
  "TCE",
  "TC",
  "TMills - NLK",
  "HT",
  "TTSL"
];

export default function SignupPage() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!name || !category || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await createUserProfile(userCredential.user.uid, {
        name,
        category,
        email,
      });
      
      toast({ title: 'Account created successfully' });
      router.push('/status');
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: 'An error occurred during registration.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Create a new account to upload and manage documents.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={loading}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Minimum 6 characters'
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={togglePasswordVisibility}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {error && <p className="text-sm text-destructive">{error}</p>}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : <><UserPlus className="mr-2 h-4 w-4" /> Sign Up</>}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
