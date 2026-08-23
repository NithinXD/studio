
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const ADMIN_EMAIL = "tcedocs2025@gmail.com";

// Username mapping for emails
const EMAIL_TO_USERNAME: { [key: string]: string } = {
  "tcedocs2025@gmail.com": "Admin",
  "tce@gmail.com": "TCE",
  "tca@gmail.com": "TCARTS",
  "newschool@gmail.com": "New School",
  "aalampattitmills@gmail.com": "Aalampatti Mills",
  "virudhunagartmills@gmail.com": "Virudhunagar Mills",
  "kappalurtmills@gmail.com": "Kappalur Mills",
  "nilakottaitmills@gmail.com": "Nilakottai Mills",
  "tmill@gmail.com": "TMILLS",
  "hr@gmail.com": "HR",
  "hometex1@gmail.com": "Hometex1",
  "hometex@gmail.com": "Hometex",
  "u3tech@gmail.com": "U3 Tech",
  "vtmtech@gmail.com": "VTM Tech",
  "marketing@domain.com": "Marketing",
  "tech@gmail.com": "Tech",
  "ee@gmail.com": "EE",
  "cotton@gmail.com": "Cotton",
  "stores@gmail.com": "Stores",
  "finance@gmail.com": "Finance",
  "vtm@gmail.com": "VTM",
  "vtmfinance@gmail.com": "VTM Finance",
  "thiagarajarmills@gmail.com": "Thiagarajar Mills",
  "auditortmilla@gmail.com": "Auditor Tmills",
  "cs@gmail.com": "CS",
  "ttsl@gmail.com": "TTSL",
  "taxation@gmail.com": "Taxation",
  "civil@gmail.com": "Civil",
  "ctl@gmail.com": "CTL",
  "it@gmail.com": "IT",
  "edp@gmail.com": "EDP",
  "transport@gmail.com": "Transport"
};

// Helper function to get username from email
export const getUsernameFromEmail = (email: string | null | undefined): string => {
  if (!email) return "Unknown";
  return EMAIL_TO_USERNAME[email] || "Unknown";
};

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => void;
  username: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  logout: () => { },
  username: "Unknown",
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const isAdmin = user?.email === ADMIN_EMAIL;
  const username = getUsernameFromEmail(user?.email);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, logout, username }}>
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
    const { user, loading, isAdmin } = useAuth();
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
    }, [user, loading, isAdmin, router]);

    if (loading || !user || (options.adminOnly && !isAdmin)) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithAuthComponent;
}
