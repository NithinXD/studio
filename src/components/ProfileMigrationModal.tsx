'use client';

import { useState } from 'react';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { createUserProfile } from '@/lib/firebaseService';
import { useAuth, ADMIN_EMAILS } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES } from '@/app/signup/page';
import { Eye, EyeOff } from 'lucide-react';

export function ProfileMigrationModal() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const auth = getAuth(app);

  const isAdminUser = Boolean(user?.email && ADMIN_EMAILS.includes(user.email));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !user.email) return;

    // Admin doesn't need category
    if (!name || (!isAdminUser && !category) || !newEmail || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // 2. Send verification for new email BEFORE saving to Firestore
      // This will throw an error immediately if the email is already in use
      if (user.email !== newEmail) {
        await verifyBeforeUpdateEmail(user, newEmail);
      }

      // 3. Save profile in Firestore ONLY if the auth checks passed
      // We always save their CURRENT auth email. If they requested a change, 
      // the background sync in use-auth.tsx will automatically update Firestore once they click the link.
      const profileData: any = {
        name,
        email: user.email,
      };
      
      if (isAdminUser) {
        profileData.role = 'admin';
      } else {
        profileData.category = category;
      }
      
      await createUserProfile(user.uid, profileData);

      if (user.email !== newEmail) {
        toast({
          title: "Profile Updated & Verification Sent",
          description: "Please check your new email's inbox to verify the change. You can continue using your old email until verified.",
        });
      } else {
        toast({
          title: "Profile Updated",
          description: "Your profile has been updated successfully.",
        });
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("Migration error:", err);
      if (err.code === 'auth/wrong-password') {
        setError("Incorrect password.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email address is already registered to another account.");
      } else {
        setError(err.message || "An error occurred during profile update.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Update Your Profile</DialogTitle>
          <DialogDescription>
            We are upgrading our system. Please provide your actual details to continue. You must verify using your current password to update your email.
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="migration-name">Full Name</Label>
              <Input
                id="migration-name"
                placeholder="Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            
            {!isAdminUser && (
              <div className="space-y-2">
                <Label htmlFor="migration-category">Category</Label>
                <Select value={category} onValueChange={setCategory} disabled={loading}>
                  <SelectTrigger id="migration-category">
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
            )}
            
            <div className="space-y-2">
              <Label htmlFor="migration-email">New Email</Label>
              <Input
                id="migration-email"
                type="email"
                placeholder="your.real.email@example.com"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="migration-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="migration-password"
                  type={showPassword ? 'text' : 'password'}
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
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Required to verify this change.</p>
            </div>
            
            {error && <p className="text-sm text-destructive">{error}</p>}
            
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating...' : 'Update Profile'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <p className="text-lg text-green-700 font-medium">Profile successfully updated!</p>
            <div className="bg-blue-50 p-4 rounded-md text-left text-sm text-blue-800 space-y-2">
              <p><strong>Important Next Step:</strong></p>
              <p>A verification email has been sent to <strong>{newEmail}</strong>.</p>
              <p>Click the link in that email to finalize the email change. After verification, login with the new email.</p>
            </div>
            <Button className="w-full mt-4" onClick={() => window.location.reload()}>
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
