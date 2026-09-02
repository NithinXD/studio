'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Document, DocumentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, FileType, Filter, Folder, Hourglass, User, X, XCircle, CheckCircle2 } from 'lucide-react';
import { withAuth, getUsernameFromEmail, type UserProfile } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllDocumentsFromFirestore, getAllUserProfiles } from '@/lib/firebaseService';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { downloadWatermarkedPdf, type WatermarkStatus } from '@/lib/pdfWatermark';

const StatusBadge = ({ status }: { status: DocumentStatus }) => {
  switch (status) {
    case 'Approved':
      return (
        <Badge className="bg-accent hover:bg-accent/80 text-accent-foreground gap-2 border-transparent">
          <CheckCircle2 className="h-4 w-4" />
          Approved
        </Badge>
      );
    case 'Declined':
      return (
        <Badge variant="destructive" className="gap-2">
          <XCircle className="h-4 w-4" />
          Declined
        </Badge>
      );
    case 'Pending':
      return (
        <Badge variant="secondary" className="gap-2">
          <Hourglass className="h-4 w-4" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

function AdminDashboardPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingWatermark, setDownloadingWatermark] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [allDocs, allProfilesArray] = await Promise.all([
          getAllDocumentsFromFirestore(),
          getAllUserProfiles()
        ]);
        
        const profileMap: Record<string, UserProfile> = {};
        allProfilesArray.forEach(p => {
          profileMap[p.id] = p;
        });
        
        setDocuments(allDocs);
        setProfiles(profileMap);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load dashboard data. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const selectedCategory = searchParams.get('category');
  const selectedUserId = searchParams.get('user');

  // Enriched Documents: Combine document with user profile info
  const enrichedDocs = useMemo(() => {
    return documents.map(doc => {
      const profile = profiles[doc.userId];
      return {
        ...doc,
        category: profile?.category || 'Uncategorized',
        userName: profile?.name || doc.userEmail || 'Unknown User'
      };
    });
  }, [documents, profiles]);

  // Aggregations: Start with all known profiles so empty users appear
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number, pending: number, approved: number, declined: number }> = {};
    
    // Initialize stats for all known categories from profiles
    Object.values(profiles).forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!stats[cat]) stats[cat] = { total: 0, pending: 0, approved: 0, declined: 0 };
    });

    enrichedDocs.forEach(doc => {
      const cat = doc.category;
      if (!stats[cat]) stats[cat] = { total: 0, pending: 0, approved: 0, declined: 0 };
      stats[cat].total++;
      if (doc.status === 'Pending') stats[cat].pending++;
      if (doc.status === 'Approved') stats[cat].approved++;
      if (doc.status === 'Declined') stats[cat].declined++;
    });
    return stats;
  }, [enrichedDocs, profiles]);

  const userStats = useMemo(() => {
    if (!selectedCategory) return {};
    const stats: Record<string, { total: number, pending: number, approved: number, declined: number, name: string }> = {};
    
    // Initialize stats for all users in the selected category
    Object.values(profiles).filter(p => (p.category || 'Uncategorized') === selectedCategory).forEach(p => {
      stats[p.id] = { total: 0, pending: 0, approved: 0, declined: 0, name: p.name || 'Unknown User' };
    });

    enrichedDocs.filter(d => d.category === selectedCategory).forEach(doc => {
      const uid = doc.userId;
      if (!stats[uid]) stats[uid] = { total: 0, pending: 0, approved: 0, declined: 0, name: doc.userName };
      stats[uid].total++;
      if (doc.status === 'Pending') stats[uid].pending++;
      if (doc.status === 'Approved') stats[uid].approved++;
      if (doc.status === 'Declined') stats[uid].declined++;
    });
    return stats;
  }, [enrichedDocs, selectedCategory, profiles]);

  // Filter documents for Level 3
  const level3Docs = useMemo(() => {
    if (!selectedCategory || !selectedUserId) return [];
    let filtered = enrichedDocs.filter(d => d.category === selectedCategory && d.userId === selectedUserId);
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.reason && doc.reason.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return filtered;
  }, [enrichedDocs, selectedCategory, selectedUserId, statusFilter, searchQuery]);

  // Pagination for Level 3
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, selectedCategory, selectedUserId]);

  const totalPages = Math.ceil(level3Docs.length / itemsPerPage);
  const paginatedDocuments = level3Docs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const downloadWatermarkedDocument = async (doc: Document, status: WatermarkStatus) => {
    setDownloadingWatermark(doc.id);
    try {
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error('Failed to fetch PDF');
      const pdfBytes = await response.arrayBuffer();
      await downloadWatermarkedPdf(pdfBytes, status, doc.name);
      toast({
        title: 'Download Complete',
        description: `Watermarked PDF downloaded successfully with ${status} status.`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ variant: "destructive", title: "Download Failed", description: "Failed to download PDF." });
    } finally {
      setDownloadingWatermark(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter('Pending');
    setSearchQuery('');
  };

  const openCategory = (cat: string) => {
    router.push(`/admin?category=${encodeURIComponent(cat)}`);
  };

  const openUser = (uid: string) => {
    router.push(`/admin?category=${encodeURIComponent(selectedCategory!)}&user=${encodeURIComponent(uid)}`);
  };

  const backToCategories = () => {
    router.push('/admin');
  };

  const backToUsers = () => {
    router.push(`/admin?category=${encodeURIComponent(selectedCategory!)}`);
  };

  const isFiltersActive = Boolean(searchQuery.trim()) || statusFilter !== 'Pending';
  
  const selectedUserName = selectedUserId ? profiles[selectedUserId]?.name || 'Unknown User' : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Dashboard</CardTitle>
        <CardDescription>Review and manage all document submissions.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* LEVEL 3: Documents */}
        {selectedCategory && selectedUserId ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={backToUsers}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Folder className="h-4 w-4" />
                  <span className="font-medium text-foreground">{selectedCategory} / {selectedUserName}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
                {isFiltersActive && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                {isFiltersActive && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground ml-2">
                    <Filter className="h-4 w-4" />
                    Filters active
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Reason for Upload</TableHead>
                    <TableHead>Upload Date-Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admin Action Time</TableHead>
                    <TableHead>Suggestions</TableHead>
                    <TableHead>Watermarked PDF</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ) : paginatedDocuments.length > 0 ? (
                    paginatedDocuments.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileType className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px]">
                          <div className="truncate" title={doc.reason || 'No reason provided'}>
                            {doc.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{new Date(doc.uploadDate).toLocaleDateString()}</div>
                            <div className="text-muted-foreground text-xs">
                              {new Date(doc.uploadDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={doc.status} />
                        </TableCell>
                        <TableCell>
                          {doc.adminDecisionDate && doc.status !== 'Pending' ? (
                            <div className="text-sm">
                              <div>{new Date(doc.adminDecisionDate).toLocaleDateString()}</div>
                              <div className="text-muted-foreground text-xs">
                                {new Date(doc.adminDecisionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px]">
                          <div className="truncate" title={doc.suggestion || '-'}>{doc.suggestion || '-'}</div>
                        </TableCell>
                        <TableCell>
                          {doc.status === 'Approved' || doc.status === 'Declined' ? (
                            <Button
                              onClick={() => downloadWatermarkedDocument(doc, doc.status as WatermarkStatus)}
                              variant="outline" size="sm"
                              className={`${doc.status === 'Approved' ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                              disabled={downloadingWatermark === doc.id}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {downloadingWatermark === doc.id ? 'Preparing...' : doc.status}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm">
                            <Link href={`/admin/review/${doc.id}`}>Review</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                        No documents match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            )}
          </>
        ) : selectedCategory ? (
          
          /* LEVEL 2: Users */
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={backToCategories}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Folder className="h-4 w-4" />
                  <span className="font-medium text-foreground">{selectedCategory}</span>
                </div>
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Name</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Declined</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ) : Object.keys(userStats).length > 0 ? (
                    Object.entries(userStats).map(([uid, stats]) => (
                      <TableRow key={uid}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {stats.name}
                          </div>
                        </TableCell>
                        <TableCell>{stats.total}</TableCell>
                        <TableCell>{stats.pending}</TableCell>
                        <TableCell>{stats.approved}</TableCell>
                        <TableCell>{stats.declined}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openUser(uid)}>Open</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No users found in this category.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          
          /* LEVEL 1: Categories */
          <>
            <div className="mb-4"></div>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Declined</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ) : Object.keys(categoryStats).length > 0 ? (
                    Object.entries(categoryStats).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, stats]) => (
                      <TableRow key={cat}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            {cat}
                          </div>
                        </TableCell>
                        <TableCell>{stats.total}</TableCell>
                        <TableCell>{stats.pending}</TableCell>
                        <TableCell>{stats.approved}</TableCell>
                        <TableCell>{stats.declined}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openCategory(cat)}>Open</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No categories found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default withAuth(AdminDashboardPage, { adminOnly: true });
