'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, withAuth } from '@/hooks/use-auth';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, deleteUser } from 'firebase/auth';
import { app, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/lib/firebaseService';
import { doc, deleteDoc } from 'firebase/firestore';
import { UserCircle, Save, Eye, EyeOff, Trash2 } from 'lucide-react';
import { CATEGORIES } from '@/app/signup/page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

function ProfilePage() {
  const { user, userProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [name, setName] = useState(userProfile?.name || '');
  const [category, setCategory] = useState(userProfile?.category || '');
  const [loading, setLoading] = useState(false);
  
  // Email update state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Delete account state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const auth = getAuth(app);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.name) setName(userProfile.name);
      if (userProfile.category) setCategory(userProfile.category);
    }
  }, [userProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name cannot be empty.' });
      return;
    }
    
    setLoading(true);
    
    try {
      const payload: any = { name, category };
      if (isAdmin) payload.role = 'admin';
      await updateUserProfile(user.uid, payload);
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully. Refresh to see changes globally.',
      });
    } catch (err: any) {
      console.error("Update error:", err);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'An error occurred while updating your profile.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!user || !user.email) return;
    if (!newEmail || !password) {
      setEmailError("Please fill in all fields.");
      return;
    }

    setEmailLoading(true);

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // 2. Send verification for new email (this will throw an error if email is already in use)
      // We no longer manually update Firestore here! The background sync in use-auth.tsx
      // will automatically detect the new email once the user clicks the verification link
      // and will sync it directly into Firestore on their next login.
      await verifyBeforeUpdateEmail(user, newEmail);
      
      toast({
        title: "Verification Email Sent",
        description: "Please check your new email's inbox to verify the change. Your login email will not change until verified.",
      });

      setEmailModalOpen(false);
      setNewEmail('');
      setPassword('');
      
    } catch (err: any) {
      console.error("Email update error:", err);
      if (err.code === 'auth/wrong-password') {
        setEmailError("Incorrect password.");
      } else if (err.code === 'auth/email-already-in-use') {
        setEmailError("This email address is already registered to another account.");
      } else {
        setEmailError(err.message || "An error occurred during email update.");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (!user || !user.email) return;
    if (!deletePassword) {
      setDeleteError("Please enter your password to confirm deletion.");
      return;
    }

    // Protect admin account from accidental deletion
    if (isAdmin) {
      setDeleteError("The primary admin account cannot be deleted from this interface.");
      return;
    }

    setDeleteLoading(true);

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Delete user profile from Firestore
      await deleteDoc(doc(db, 'users', user.uid));

      // 3. Delete Firebase Auth User
      await deleteUser(user);
      
      toast({
        title: "Account Deleted",
        description: "Your account and profile have been permanently deleted.",
      });

      // User will automatically be logged out and redirected by withAuth/onAuthStateChanged
      
    } catch (err: any) {
      console.error("Account deletion error:", err);
      if (err.code === 'auth/wrong-password') {
        setDeleteError("Incorrect password.");
      } else {
        setDeleteError(err.message || "An error occurred while deleting your account.");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // withAuth already handles loading states, so if we reach here and userProfile is null,
  // it means they don't have a profile yet (e.g. an admin who skipped migration)

  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <UserCircle className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Your Profile</CardTitle>
          <CardDescription>View your details and manage your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
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
              <Select value={category} onValueChange={setCategory} disabled={loading || isAdmin}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  {isAdmin && <SelectItem value="Uncategorized (Admin)">Uncategorized (Admin)</SelectItem>}
                </SelectContent>
              </Select>
              {isAdmin && <p className="text-xs text-muted-foreground">Admin category cannot be changed.</p>}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Email</Label>
                <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs">
                      Change Email
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Change Email Address</DialogTitle>
                      <DialogDescription>
                        Enter your new email and verify your current password. We will send a verification link to the new address.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-email">New Email</Label>
                        <Input
                          id="new-email"
                          type="email"
                          placeholder="new@example.com"
                          required
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          disabled={emailLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={emailLoading}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={emailLoading}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                      
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEmailModalOpen(false)} disabled={emailLoading}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={handleUpdateEmail} disabled={emailLoading}>
                          {emailLoading ? 'Sending...' : 'Send Verification'}
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            
            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Profile</>}
            </Button>
          </form>
        </CardContent>
        
        {!isAdmin && (
          <CardFooter className="flex justify-center border-t p-4 mt-4">
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your user account and profile. Your uploaded documents will remain but will no longer be linked to this account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="delete-password">Confirm Current Password</Label>
                    <div className="relative">
                      <Input
                        id="delete-password"
                        type={showDeletePassword ? 'text' : 'password'}
                        required
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        disabled={deleteLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowDeletePassword(!showDeletePassword)}
                        disabled={deleteLoading}
                      >
                        {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
                      Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading}>
                      {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default withAuth(ProfilePage);
