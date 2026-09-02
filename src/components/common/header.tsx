
'use client';

import Link from 'next/link';
import { FileText, Shield, LogIn, LogOut, Menu, X, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';

export function Header() {
  const { user, userProfile, isAdmin, logout, username, loading, profileLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const needsMigration = user && !loading && !profileLoading && (!userProfile || (!isAdmin && !userProfile.category));

  return (
    <header className="bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-40 border-b">
      <div className="container mx-auto flex h-16 items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
          <FileText className="h-6 w-6" />
          <span className="font-headline">TAAS</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-2">
          {needsMigration ? (
            <Button variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          ) : user && isAdmin ? (
            <>
              <span className="text-sm text-muted-foreground mr-4">Welcome, {username}</span>
              <Button variant="ghost" asChild>
                <Link href="/profile">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </Button>
              <Button variant="outline" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            // Regular user navigation
            <>
              <Button variant="ghost" asChild>
                <Link href="/">Home</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/upload">Upload</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/status">Status</Link>
              </Button>
              <Separator orientation="vertical" className="h-6 mx-2" />
              {user ? (
                <>
                  <span className="text-sm text-muted-foreground mr-4">Welcome, {username}</span>
                  <Button variant="ghost" asChild>
                    <Link href="/profile">
                      <UserCircle className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Link>
                </Button>
              )}
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleMobileMenu}
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <nav className="md:hidden bg-card/95 backdrop-blur-sm border-t">
          <div className="container mx-auto p-4 space-y-2">
            {needsMigration ? (
              <Button variant="outline" className="w-full justify-start" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            ) : user && isAdmin ? (
              // Admin mobile navigation
              <>
                <div className="text-sm text-muted-foreground mb-3">Welcome, {username}</div>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              // Regular user mobile navigation
              <>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                    Home
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/upload" onClick={() => setIsMobileMenuOpen(false)}>
                    Upload
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/status" onClick={() => setIsMobileMenuOpen(false)}>
                    Status
                  </Link>
                </Button>
                {user ? (
                  <>
                    <div className="text-sm text-muted-foreground my-2">Welcome, {username}</div>
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                        <UserCircle className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
