
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, X, User, Calendar, ArrowLeft, ExternalLink, MessageSquare, Download } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {getUsernameFromEmail, useAuth } from '@/hooks/use-auth';
import { Label } from '@/components/ui/label';
import type { Document } from '@/lib/types';
import { updateDocumentInFirestore } from '@/lib/firebaseService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { downloadWatermarkedPdf, type WatermarkStatus } from '@/lib/pdfWatermark';

export function DocumentReviewClient({ document }: { document: Document }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [suggestion, setSuggestion] = useState(document.suggestion || '');
  const [loading, setLoading] = useState(false);
  const [dialogSuggestion, setDialogSuggestion] = useState('');
  const [approveWithSuggestionOpen, setApproveWithSuggestionOpen] = useState(false);
  const [declineWithSuggestionOpen, setDeclineWithSuggestionOpen] = useState(false);
  const [downloadingWatermark, setDownloadingWatermark] = useState(false);
  const driveFolderUrl = "https://drive.google.com/drive/u/5/folders/18tppk1V3BX5aliGjhLwuRHUPNdt-GSaT";

  const downloadWatermarkedDocument = async (status: WatermarkStatus) => {
    setDownloadingWatermark(true);
    try {
      // Fetch the PDF from the URL
      const response = await fetch(document.url);
      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }
      
      const pdfBytes = await response.arrayBuffer();
      await downloadWatermarkedPdf(pdfBytes, status, document.name);
      
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
      setDownloadingWatermark(false);
    }
  };

  const updateDocumentStatus = async (status: 'Approved' | 'Declined', suggestionText?: string) => {
    setLoading(true);
    try {
      await updateDocumentInFirestore(document.id, {
        status,
        suggestion: suggestionText || undefined,
      }, user?.email || undefined);
      
      toast({
        title: `Document ${status}`,
        description: `"${document.name}" has been marked as ${status.toLowerCase()}.`,
      });
      router.push('/admin');
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update document status. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    updateDocumentStatus('Approved', 'N/A');
  };

  const handleDecline = () => {
    updateDocumentStatus('Declined', 'N/A');
  };
  
  const handleApproveWithSuggestion = () => {
    if (!dialogSuggestion.trim()) {
      toast({
        variant: "destructive",
        title: "Suggestion Required",
        description: "Please provide a suggestion before approving.",
      });
      return;
    }
    updateDocumentStatus('Approved', dialogSuggestion);
    setApproveWithSuggestionOpen(false);
    setDialogSuggestion('');
  };

  const handleDeclineWithSuggestion = () => {
    if (!dialogSuggestion.trim()) {
      toast({
        variant: "destructive",
        title: "Reason Required",
        description: "Please provide a reason for declining.",
      });
      return;
    }
    updateDocumentStatus('Declined', dialogSuggestion);
    setDeclineWithSuggestionOpen(false);
    setDialogSuggestion('');
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Review Document</CardTitle>
            <CardDescription>
              Review the submitted PDF document below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{document.name}</h3>
                <Button asChild variant="outline" size="sm">
                  <a href={document.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open PDF
                  </a>
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={document.url}
                  className="w-full h-[600px]"
                  title="PDF Document"
                />
              </div>
              
              <Alert>
                <ExternalLink className="h-4 w-4" />
                <AlertTitle>Document Details</AlertTitle>
                <AlertDescription>
                  If the PDF doesn't display properly, use the "Open PDF" button above to view it in a new tab.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle className="truncate">{document.name}</CardTitle>
            <CardDescription>Details and actions for this document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>Submitted by: <strong className="font-semibold">{getUsernameFromEmail(document.userEmail)}</strong></span>
            </div>
            <div className="flex items-start gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div>Uploaded on: <strong className="font-semibold">{new Date(document.uploadDate).toLocaleDateString()}</strong></div>
                  <div className="text-muted-foreground text-xs">
                    Time: {new Date(document.uploadDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
            </div>
            {document.reason && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Reason for Upload</Label>
                </div>
                <div className="text-sm p-3 bg-muted rounded-md border">
                  {document.reason}
                </div>
              </div>
            )}
            {document.adminDecisionDate && document.status !== 'Pending' && (
              <div className="flex items-start gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div>Decision made on: <strong className="font-semibold">{new Date(document.adminDecisionDate).toLocaleDateString()}</strong></div>
                  <div className="text-muted-foreground text-xs">
                    Time: {new Date(document.adminDecisionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {document.adminDecisionBy && (
                      <span> by {getUsernameFromEmail(document.adminDecisionBy)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <Separator className="my-2" />
            {document.suggestion && (
              <div className="space-y-2">
                <Label>Current Suggestion</Label>
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  {document.suggestion}
                </div>
              </div>
            )}

            {/* Watermarked PDF Download Section - Only show for Approved or Declined documents */}
            {(document.status === 'Approved' || document.status === 'Declined') && (
              <div className="space-y-2">
                <Label>Download Watermarked PDF</Label>
                <div className="flex flex-col gap-2">
                  {document.status === 'Approved' && (
                    <Button
                      onClick={() => downloadWatermarkedDocument('Approved')}
                      variant="outline"
                      size="sm"
                      className="w-full text-green-600 border-green-200 hover:bg-green-50"
                      disabled={downloadingWatermark}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloadingWatermark ? 'Preparing...' : 'Download Approved PDF'}
                    </Button>
                  )}
                  {document.status === 'Declined' && (
                    <Button
                      onClick={() => downloadWatermarkedDocument('Declined')}
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                      disabled={downloadingWatermark}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloadingWatermark ? 'Preparing...' : 'Download Declined PDF'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 pt-0">
            {document.status === 'Pending' ? (
              <>
                <Button onClick={handleApprove} className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
                  <Check className="mr-2 h-4 w-4" /> {loading ? "Processing..." : "Approve"}
                </Button>
              
              <Dialog open={approveWithSuggestionOpen} onOpenChange={setApproveWithSuggestionOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-green-500 hover:bg-green-600 text-white" disabled={loading}>
                    <Check className="mr-2 h-4 w-4" /> Approve with Suggestions
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve with Suggestions</DialogTitle>
                    <DialogDescription>
                      Provide suggestions for the approved document.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="approve-suggestion">Suggestions</Label>
                    <Textarea 
                      id="approve-suggestion"
                      placeholder="Enter your suggestions here..."
                      value={dialogSuggestion}
                      onChange={(e) => setDialogSuggestion(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setApproveWithSuggestionOpen(false);
                      setDialogSuggestion('');
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleApproveWithSuggestion} className="bg-green-600 hover:bg-green-700 text-white">
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={handleDecline} variant="destructive" className="w-full" disabled={loading}>
                <X className="mr-2 h-4 w-4" /> {loading ? "Processing..." : "Decline"}
              </Button>

              <Dialog open={declineWithSuggestionOpen} onOpenChange={setDeclineWithSuggestionOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
                    <X className="mr-2 h-4 w-4" /> Decline with Suggestions
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Decline with Suggestions</DialogTitle>
                    <DialogDescription>
                      Provide reasons for declining this document.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="decline-suggestion">Reasons / Suggestions</Label>
                    <Textarea 
                      id="decline-suggestion"
                      placeholder="Enter your reasons or suggestions here..."
                      value={dialogSuggestion}
                      onChange={(e) => setDialogSuggestion(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setDeclineWithSuggestionOpen(false);
                      setDialogSuggestion('');
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleDeclineWithSuggestion} variant="destructive">
                      <X className="mr-2 h-4 w-4" /> Decline
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                Document has been {document.status.toLowerCase()}
              </div>
            )}

            <Button variant="outline" className="w-full mt-2" asChild>
              <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Back to List</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
