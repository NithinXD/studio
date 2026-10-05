'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Download, AlertCircle, FileArchive, CalendarDays, Loader2, CheckCircle2, FileText, Calculator, Trash2 } from 'lucide-react';
import { withAuth, getUsernameFromEmail } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getDocumentsByDateRange, getOldestDocumentDate, deleteDocumentFromFirestore } from '@/lib/firebaseService';

function BackupPage() {
  const { toast } = useToast();

  // Date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minStartDate, setMinStartDate] = useState<string | undefined>(undefined);

  // Process state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [docCount, setDocCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Danger zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    async function fetchOldestDate() {
      const oldestDate = await getOldestDocumentDate();
      if (oldestDate) {
        setMinStartDate(oldestDate.toISOString().split('T')[0]);
      }
    }
    fetchOldestDate();
  }, []);

  const getMaxDate = () => new Date().toISOString().split('T')[0];
  const getMinDateForEnd = () => startDate || undefined;
  const getMaxDateForStart = () => endDate || getMaxDate();
  
  const getMaxAllowedEndDate = () => {
    if (!startDate) return getMaxDate();
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + 6);
    const today = new Date();
    return (start > today ? today : start).toISOString().split('T')[0];
  };

  const validateDateRange = (): string | null => {
    if (!startDate || !endDate) return 'Please select both a start date and end date.';
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 'Start date cannot be after end date.';
    const maxRangeMs = 190 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRangeMs) {
      return 'Date range cannot exceed 6 months. Please narrow your selection.';
    }
    if (end > new Date()) return 'End date cannot be in the future.';
    return null;
  };

  const getQueryBounds = () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const formatCSV = (docs: any[]) => {
    const headers = ['File Name', 'Upload Date', 'Uploaded By', 'Status', 'Reason', 'Database ID', 'URL'];
    const rows = docs.map(doc => {
      let formattedDate = '';
      if (doc.uploadDate) {
        const d = new Date(doc.uploadDate);
        if (!isNaN(d.getTime())) {
          // Force IST timezone (Asia/Kolkata) and 24-hour format
          const dateString = d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          // Convert "DD/MM/YYYY, HH:mm" -> "DD-MM-YYYY HH:mm"
          formattedDate = dateString.replace(/\//g, '-').replace(',', '');
        } else {
          formattedDate = doc.uploadDate; // fallback if it's already a weird string
        }
      }
      return [
        `"${(doc.name || '').replace(/"/g, '""')}"`,
        `"${formattedDate}"`,
        `"${doc.userEmail || ''}"`,
        `"${doc.status || ''}"`,
        `"${(doc.reason || '').replace(/"/g, '""')}"`,
        `"${doc.id || ''}"`,
        `"${doc.url || ''}"`
      ];
    });
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCheckCount = async () => {
    setError(null);
    setDocCount(null);
    setShowDeleteConfirm(false);
    
    const validationError = validateDateRange();
    if (validationError) return setError(validationError);

    setLoading(true);
    setStatusMessage('Counting documents...');
    
    try {
      const { start, end } = getQueryBounds();
      const documents = await getDocumentsByDateRange(start, end);
      setDocCount(documents.length);
      setStatusMessage(`Found exactly ${documents.length} documents in this range.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvBackup = async () => {
    setError(null);
    const validationError = validateDateRange();
    if (validationError) return setError(validationError);

    setLoading(true);
    setStatusMessage('Generating CSV Backup...');
    
    try {
      const { start, end } = getQueryBounds();
      const documents = await getDocumentsByDateRange(start, end);
      
      if (documents.length === 0) {
        setError('No documents found in this range.');
        return;
      }

      const csvData = formatCSV(documents);
      const formattedStart = startDate.replace(/-/g, '');
      const formattedEnd = endDate.replace(/-/g, '');
      downloadBlob(new Blob([csvData], { type: 'text/csv' }), `database_records_${formattedStart}_to_${formattedEnd}.csv`);
      
      setStatusMessage(`Successfully downloaded CSV with ${documents.length} records.`);
      setDocCount(documents.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleZipBackup = async () => {
    setError(null);
    const validationError = validateDateRange();
    if (validationError) return setError(validationError);

    setLoading(true);
    setProgress(0);
    setStatusMessage('Querying documents...');

    try {
      const { start, end } = getQueryBounds();
      const documents = await getDocumentsByDateRange(start, end);

      if (documents.length === 0) {
        setError('No documents found in this range.');
        setLoading(false);
        setStatusMessage('');
        return;
      }

      setDocCount(documents.length);
      setStatusMessage(`Found ${documents.length} documents. Preparing ZIP...`);
      setProgress(10);

      const zip = new JSZip();
      
      // Include CSV automatically inside the ZIP!
      zip.file('database_records.csv', formatCSV(documents));

      let completed = 0;
      let failed = 0;
      const failedFiles: string[] = [];

      for (const doc of documents) {
        try {
          const username = getUsernameFromEmail(doc.userEmail || 'unknown');
          let uploadDate = 'unknown-date';
          if (doc.uploadDate) {
            const d = new Date(doc.uploadDate);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            uploadDate = `${day}-${month}-${d.getFullYear()}`;
          }

          let downloadUrl = doc.url;
          if (downloadUrl.includes('yzxotiqjaetxnjjmybbe.supabase.co')) {
            downloadUrl = downloadUrl.replace(
              'yzxotiqjaetxnjjmybbe.supabase.co',
              'nnpskdnyhmzzafnlwrie.supabase.co'
            );
          }

          setStatusMessage(`Downloading: ${doc.name} (${completed + 1}/${documents.length})`);
          
          const response = await fetch(downloadUrl);
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();

          const folderPath = username;
          const fileName = `${uploadDate}_${doc.name}`;
          zip.file(`${folderPath}/${fileName}`, arrayBuffer);

          completed++;
        } catch (fetchErr) {
          failed++;
          failedFiles.push(doc.name);
          console.warn(`Failed to download ${doc.name}:`, fetchErr);
        }

        setProgress(10 + ((completed + failed) / documents.length) * 80);
      }

      if (failed > 0) {
        const reportContent = `BACKUP REPORT\n-------------------\nTotal files requested: ${documents.length}\nSuccessfully downloaded: ${completed}\nFailed downloads: ${failed}\n\nThe following files could not be downloaded:\n\n${failedFiles.join('\n')}`;
        zip.file('backup_report.txt', reportContent);
      }

      setStatusMessage('Generating ZIP file...');
      setProgress(92);

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      }, (metadata) => {
        setProgress(Math.round(92 + (metadata.percent / 100) * 8));
      });

      const formattedStart = startDate.replace(/-/g, '');
      const formattedEnd = endDate.replace(/-/g, '');
      downloadBlob(zipBlob, `backup_${formattedStart}_to_${formattedEnd}.zip`);

      setProgress(100);

      if (failed > 0) {
        setStatusMessage(`Done! Downloaded ${completed} files. ${failed} file(s) failed.`);
        toast({ title: 'Backup Partially Complete', description: `${completed} files downloaded. ${failed} failed.` });
      } else {
        setStatusMessage(`Backup complete! ${completed} files downloaded.`);
        toast({ title: 'Backup Complete', description: `Successfully backed up ${completed} documents.` });
      }
    } catch (err: any) {
      console.error('Backup error:', err);
      setError(err.message || 'An unexpected error occurred.');
      setStatusMessage('');
      toast({ variant: 'destructive', title: 'Backup Failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecords = async () => {
    if (deleteInput !== 'DELETE') {
      setError('You must type DELETE exactly to confirm.');
      return;
    }

    setError(null);
    setLoading(true);
    setProgress(0);
    setStatusMessage('Deleting records from Firebase...');

    try {
      const { start, end } = getQueryBounds();
      const documents = await getDocumentsByDateRange(start, end);
      
      if (documents.length === 0) {
        setError('No documents found in this range to delete.');
        setLoading(false);
        return;
      }

      let deletedCount = 0;
      for (const doc of documents) {
        setStatusMessage(`Deleting record ${deletedCount + 1} of ${documents.length}...`);
        await deleteDocumentFromFirestore(doc.id);
        deletedCount++;
        setProgress(Math.round((deletedCount / documents.length) * 100));
      }

      setStatusMessage(`Successfully deleted ${deletedCount} records from Firebase.`);
      setDocCount(0);
      setShowDeleteConfirm(false);
      setDeleteInput('');
      toast({ title: 'Deletion Complete', description: `Wiped ${deletedCount} records permanently.` });
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'An error occurred during deletion.');
      toast({ variant: 'destructive', title: 'Deletion Failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            <CardTitle>Data Backup & Export</CardTitle>
          </div>
          <CardDescription>
            Select a date range to count, export, or download documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Start Date
              </Label>
              <Input
                id="start-date" type="date" value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value); setError(null); setDocCount(null); setShowDeleteConfirm(false);
                  if (e.target.value) {
                    const start = new Date(e.target.value);
                    start.setMonth(start.getMonth() + 6);
                    const today = new Date();
                    setEndDate((start > today ? today : start).toISOString().split('T')[0]);
                  } else {
                    setEndDate('');
                  }
                }}
                min={minStartDate} max={getMaxDateForStart()} disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> End Date
              </Label>
              <Input
                id="end-date" type="date" value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setError(null); setDocCount(null); setShowDeleteConfirm(false); }}
                min={getMinDateForEnd()} max={getMaxAllowedEndDate()} disabled={loading}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleCheckCount} disabled={loading || !startDate || !endDate} variant="secondary" className="flex-1">
              <Calculator className="h-4 w-4 mr-2" /> Check Count
            </Button>
            <Button onClick={handleCsvBackup} disabled={loading || !startDate || !endDate} variant="outline" className="flex-1">
              <FileText className="h-4 w-4 mr-2" /> Download CSV Only
            </Button>
          </div>
          
          <Button onClick={handleZipBackup} disabled={loading || !startDate || !endDate} className="w-full gap-2" size="lg">
            {loading && statusMessage.includes('ZIP') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Full ZIP + CSV
          </Button>

          {/* Error & Progress Messages */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {docCount !== null && !error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-accent/30 text-accent-foreground font-medium text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
              <span>Found exactly {docCount} documents in this date range.</span>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{statusMessage}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DANGER ZONE */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-600">Danger Zone: Database Cleanup</CardTitle>
          </div>
          <CardDescription className="text-red-700/80">
            Permanently delete all Firebase records within the selected date range. 
            <strong> Ensure you have downloaded and verified your CSV backup first!</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <Button 
              variant="destructive" 
              className="w-full"
              disabled={loading || !startDate || !endDate || docCount === null || docCount === 0}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Wipe {docCount !== null ? docCount : 'Selected'} Records from Firebase
            </Button>
          ) : (
            <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-white">
              <Label className="text-red-600 font-bold">
                WARNING: This will permanently delete {docCount} records from Firebase.
              </Label>
              <p className="text-sm text-muted-foreground">Type <strong>DELETE</strong> below to confirm.</p>
              <Input 
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="border-red-300 focus-visible:ring-red-500"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => {setShowDeleteConfirm(false); setDeleteInput('');}}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDeleteRecords} disabled={deleteInput !== 'DELETE'}>
                  Confirm Deletion
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(BackupPage, { adminOnly: true });
