
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Document, DocumentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, FileType, Filter, Folder, Hourglass, User, X, XCircle, CheckCircle2 } from 'lucide-react';
import { withAuth, getUsernameFromEmail } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllDocumentsFromFirestore } from '@/lib/firebaseService';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { debugDocuments } from '@/lib/debugUtils';
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
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingWatermark, setDownloadingWatermark] = useState<string | null>(null);

  const downloadWatermarkedDocument = async (doc: Document, status: WatermarkStatus) => {
    setDownloadingWatermark(doc.id);
    try {
      // Fetch the PDF from the URL
      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }
      
      const pdfBytes = await response.arrayBuffer();
      await downloadWatermarkedPdf(pdfBytes, status, doc.name);
      
      toast({
        title: 'Download Complete',
        description: `Watermarked PDF downloaded successfully with ${status} status.`,
      });
    } catch (error) {
      console.error('Error downloading watermarked PDF:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download watermarked PDF. Please try again.",
      });
    } finally {
      setDownloadingWatermark(null);
    }
  };

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const allDocuments = await getAllDocumentsFromFirestore();
        setDocuments(allDocuments);
        setFilteredDocuments(allDocuments);
        
        // Debug: Log document structure
        console.log('=== ADMIN DEBUG ===');
        await debugDocuments();
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load documents. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [toast]);

  // Sync selected account from URL (?account=<email>)
  useEffect(() => {
    const account = searchParams.get('account');
    setSelectedAccountEmail(account);
  }, [searchParams]);

  // Filter documents based on user, status, and search query
  useEffect(() => {
    let filtered = documents;

    // Filter by selected account
    if (selectedAccountEmail) {
      filtered = filtered.filter(doc => doc.userEmail === selectedAccountEmail);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Filter by search query (document name and reason)
    if (searchQuery.trim()) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.reason && doc.reason.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredDocuments(filtered);
  }, [documents, selectedAccountEmail, statusFilter, searchQuery]);

  // Get unique users for filter dropdown
  const uniqueUsers = Array.from(new Set(documents.map(doc => doc.userEmail)))
    .map(email => ({
      email,
      username: getUsernameFromEmail(email)
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  const accountCounts = useMemo(() => {
    const counts = new Map<
      string,
      { total: number; pending: number; approved: number; declined: number }
    >();

    for (const doc of documents) {
      const current = counts.get(doc.userEmail) ?? {
        total: 0,
        pending: 0,
        approved: 0,
        declined: 0,
      };

      current.total += 1;
      if (doc.status === 'Pending') current.pending += 1;
      if (doc.status === 'Approved') current.approved += 1;
      if (doc.status === 'Declined') current.declined += 1;

      counts.set(doc.userEmail, current);
    }

    return counts;
  }, [documents]);

  const clearFilters = () => {
    setStatusFilter('Pending'); // Reset to default pending status
    setSearchQuery('');
  };

  const openAccount = (email: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('account', email);
    router.push(`/admin?${params.toString()}`);
  };

  const backToAccounts = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('account');
    const query = params.toString();
    router.push(query ? `/admin?${query}` : '/admin');
  };

  const selectedAccountName = selectedAccountEmail
    ? getUsernameFromEmail(selectedAccountEmail)
    : null;

  const isFiltersActive = Boolean(searchQuery.trim()) || statusFilter !== 'Pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Dashboard</CardTitle>
        <CardDescription>Review and manage all document submissions.</CardDescription>
      </CardHeader>
      <CardContent>
        {selectedAccountEmail ? (
          <>
            {/* Account header + back */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={backToAccounts}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Folder className="h-4 w-4" />
                  <span className="font-medium text-foreground">{selectedAccountName}</span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {filteredDocuments.length} of {documents.length} documents
              </div>
            </div>

            {/* Filters (within account) */}
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
                    <TableHead>User</TableHead>
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
                      <TableCell colSpan={9}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : filteredDocuments.length > 0 ? (
                    filteredDocuments.map((doc: Document) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileType className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {getUsernameFromEmail(doc.userEmail)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px]">
                          <div className="truncate" title={doc.reason || 'No reason provided'}>
                            {doc.reason || (
                              <span className="text-muted-foreground italic">No reason provided</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{new Date(doc.uploadDate).toLocaleDateString()}</div>
                            <div className="text-muted-foreground text-xs">
                              {new Date(doc.uploadDate).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
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
                                {new Date(doc.adminDecisionDate).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {doc.adminDecisionBy && (
                                  <div>by {getUsernameFromEmail(doc.adminDecisionBy)}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px]">
                          <div className="truncate" title={doc.suggestion || '-'}>
                            {doc.suggestion || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.status === 'Approved' || doc.status === 'Declined' ? (
                            <Button
                              onClick={() =>
                                downloadWatermarkedDocument(doc, doc.status as WatermarkStatus)
                              }
                              variant="outline"
                              size="sm"
                              className={`${
                                doc.status === 'Approved'
                                  ? 'text-green-600 border-green-200 hover:bg-green-50'
                                  : 'text-red-600 border-red-200 hover:bg-red-50'
                              }`}
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
                      <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                        {documents.length === 0
                          ? 'No documents have been submitted yet.'
                          : 'No documents match the current filters.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <>
            {/* Accounts root */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                Showing {uniqueUsers.length} accounts • {documents.length} documents
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
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
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : uniqueUsers.length > 0 ? (
                    uniqueUsers.map((user) => {
                      const counts =
                        accountCounts.get(user.email) ??
                        ({ total: 0, pending: 0, approved: 0, declined: 0 } as const);
                      return (
                        <TableRow key={user.email}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-muted-foreground" />
                              {user.username}
                            </div>
                          </TableCell>
                          <TableCell>{counts.total}</TableCell>
                          <TableCell>{counts.pending}</TableCell>
                          <TableCell>{counts.approved}</TableCell>
                          <TableCell>{counts.declined}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => openAccount(user.email)}>
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No accounts found yet.
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
