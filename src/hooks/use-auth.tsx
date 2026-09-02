'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserProfile } from '@/lib/firebaseService';
import { ProfileMigrationModal } from '@/components/ProfileMigrationModal';

// Add any new admin emails here if the admin decides to change their email address
export const ADMIN_EMAILS = ["tcedocs2025@gmail.com"];

export interface UserProfile {
  id: string;
  name?: string;
  category?: string;
  email?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  logout: () => void;
  username: string;
}

export const getUsernameFromEmail = (email: string | null | undefined): string => {
  return email ? email.split('@')[0] : "Unknown";
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isAdmin: false,
  loading: true,
  profileLoading: true,
  logout: () => {},
  username: "Unknown",
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const auth = getAuth(app);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const profile = await getUserProfile(firebaseUser.uid) as UserProfile | null;
          
          // Auto-sync email if the user verified a new email address
          if (profile && firebaseUser.email && profile.email !== firebaseUser.email) {
            const { updateUserProfile } = await import('@/lib/firebaseService');
            await updateUserProfile(firebaseUser.uid, { email: firebaseUser.email });
            setUserProfile({ ...profile, email: firebaseUser.email });
          } else {
            setUserProfile(profile);
          }
        } catch (error) {
          console.error("Failed to fetch user profile", error);
          setUserProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const isAdmin = Boolean(userProfile?.role === 'admin' || (user?.email && ADMIN_EMAILS.includes(user.email)));
  
  const username = userProfile?.name || getUsernameFromEmail(user?.email);

  return (
    <AuthContext.Provider value={{ user, userProfile, isAdmin, loading, profileLoading, logout, username }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: { adminOnly?: boolean } = {}
) {
  const WithAuthComponent = (props: P) => {
    const { user, userProfile, loading, profileLoading, isAdmin } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (loading) return;

      if (!user) {
        router.replace('/login');
        return;
      }

      if (options.adminOnly && !isAdmin) {
        router.replace('/');
      }
    }, [user, loading, isAdmin, router, options.adminOnly]);

    if (loading || profileLoading || !user || (options.adminOnly && !isAdmin)) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    // Admin needs migration ONLY if they have no profile. Regular users need it if they have no profile OR no category.
    const isAdminUser = Boolean(userProfile?.role === 'admin' || (user?.email && ADMIN_EMAILS.includes(user.email)));
    const needsMigration = !userProfile || (!isAdminUser && !userProfile.category);
    
    if (needsMigration) {
      return <ProfileMigrationModal />;
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithAuthComponent;
}
