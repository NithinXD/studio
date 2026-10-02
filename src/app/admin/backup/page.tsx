
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Download, AlertCircle, FileArchive, CalendarDays, Loader2, CheckCircle2 } from 'lucide-react';
import { withAuth, getUsernameFromEmail } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getDocumentsByDateRange, getOldestDocumentDate } from '@/lib/firebaseService';

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

  useEffect(() => {
    async function fetchOldestDate() {
      const oldestDate = await getOldestDocumentDate();
      if (oldestDate) {
        // Format as YYYY-MM-DD for the date input
        setMinStartDate(oldestDate.toISOString().split('T')[0]);
      }
    }
    fetchOldestDate();
  }, []);

  const getMaxDate = () => {
    return new Date().toISOString().split('T')[0]; // today
  };

  const getMinDateForEnd = () => {
    return startDate || undefined;
  };

  const getMaxDateForStart = () => {
    return endDate || getMaxDate();
  };

  const getMaxAllowedEndDate = () => {
    if (!startDate) return getMaxDate();
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + 6);
    const today = new Date();
    return (start > today ? today : start).toISOString().split('T')[0];
  };

  const validateDateRange = (): string | null => {
    if (!startDate || !endDate) {
      return 'Please select both a start date and end date.';
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return 'Start date cannot be after end date.';
    }

    // Check max 6-month range (using 190 days to account for 31-day months)
    const maxRangeMs = 190 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRangeMs) {
      return 'Date range cannot exceed 6 months. Please narrow your selection.';
    }

    if (end > new Date()) {
      return 'End date cannot be in the future.';
    }

    return null;
  };

  const handleBackup = async () => {
    setError(null);
    setDocCount(null);

    // Validate
    const validationError = validateDateRange();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatusMessage('Querying documents...');

    try {
      // Set end date to end of day so documents from that day are included
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // 1. Query Firestore for docs in range
      const documents = await getDocumentsByDateRange(start, end);

      if (documents.length === 0) {
        setError(`No documents found between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}.`);
        setLoading(false);
        setStatusMessage('');
        return;
      }

      setDocCount(documents.length);
      setStatusMessage(`Found ${documents.length} documents. Preparing ZIP...`);
      setProgress(10);

      // 2. Create ZIP organized by user folders
      const zip = new JSZip();
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

          // Patch the URL: The database still has the old dead project ID saved.
          // We will swap it out for your new, healthy project ID on the fly.
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

          // Organize: username/date_filename
          const folderPath = username;
          const fileName = `${uploadDate} ${doc.name}`;
          zip.file(`${folderPath}/${fileName}`, arrayBuffer);

          completed++;
        } catch (fetchErr) {
          failed++;
          failedFiles.push(doc.name);
          // Changed to warn so Next.js doesn't pop up a red screen overlay during the loop
          console.warn(`Failed to download ${doc.name}:`, fetchErr);
        }

        // Update progress (10% for query, 80% for downloads, 10% for zip generation)
        const downloadProgress = 10 + ((completed + failed) / documents.length) * 80;
        setProgress(Math.round(downloadProgress));
      }

      // If any files failed, add a text report into the ZIP file for the admin
      if (failed > 0) {
        const reportContent = `BACKUP REPORT\n-------------------\nTotal files requested: ${documents.length}\nSuccessfully downloaded: ${completed}\nFailed downloads: ${failed}\n\nThe following files could not be downloaded (they may have been deleted from Supabase storage or blocked by CORS):\n\n${failedFiles.join('\n')}`;
        zip.file('backup_report.txt', reportContent);
      }

      // 3. Generate the ZIP
      setStatusMessage('Generating ZIP file...');
      setProgress(92);

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      }, (metadata) => {
        const zipProgress = 92 + (metadata.percent / 100) * 8;
        setProgress(Math.round(zipProgress));
      });

      // 4. Trigger download
      const formattedStart = startDate.replace(/-/g, '');
      const formattedEnd = endDate.replace(/-/g, '');
      const zipFileName = `backup_${formattedStart}_to_${formattedEnd}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);

      if (failed > 0) {
        setStatusMessage(`Done! Downloaded ${completed} files. ${failed} file(s) failed.`);
        toast({
          title: 'Backup Partially Complete',
          description: `${completed} files downloaded. ${failed} file(s) could not be fetched: ${failedFiles.join(', ')}`,
        });
      } else {
        setStatusMessage(`Backup complete! ${completed} files downloaded.`);
        toast({
          title: 'Backup Complete',
          description: `Successfully backed up ${completed} documents as ${zipFileName}`,
        });
      }
    } catch (err) {
      console.error('Backup error:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      setStatusMessage('');
      toast({
        variant: 'destructive',
        title: 'Backup Failed',
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            <CardTitle>Backup Documents</CardTitle>
          </div>
          <CardDescription>
            Download all documents within a custom date range as a ZIP file, organized by user folders. Maximum range: 6 months.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setStartDate(newStartDate);
                  setError(null);
                  setDocCount(null);

                  if (newStartDate) {
                    const start = new Date(newStartDate);
                    start.setMonth(start.getMonth() + 6);
                    
                    const today = new Date();
                    // Cap the end date at today if 6 months is in the future
                    const finalEndDate = start > today ? today : start;
                    
                    setEndDate(finalEndDate.toISOString().split('T')[0]);
                  } else {
                    setEndDate('');
                  }
                }}
                min={minStartDate}
                max={getMaxDateForStart()}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setError(null);
                  setDocCount(null);
                }}
                min={getMinDateForEnd()}
                max={getMaxAllowedEndDate()}
                disabled={loading}
              />
            </div>
          </div>

          {/* Info Text */}
          <p className="text-xs text-muted-foreground">
            Files will be organized as: <code className="bg-muted px-1 py-0.5 rounded">username/date_filename.pdf</code>
          </p>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {loading && (
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{statusMessage}</span>
              </div>
            </div>
          )}

          {/* Success message after completion */}
          {!loading && progress === 100 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-accent/30 text-accent-foreground text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Download Button */}
          <Button
            onClick={handleBackup}
            disabled={loading || !startDate || !endDate}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing Backup... {progress}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Backup ZIP
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(BackupPage, { adminOnly: true });
