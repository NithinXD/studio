
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { Document, DocumentStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, CheckCircle2, XCircle, Hourglass, Printer, Eye, Download, Trash2 } from 'lucide-react';
import { withAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteDocumentFromFirestore, getUserDocumentsFromFirestore } from '@/lib/firebaseService';
import { useToast } from '@/hooks/use-toast';
import { downloadWatermarkedPdf, type WatermarkStatus } from '@/lib/pdfWatermark';
import { deletePdfFromSupabase } from '@/lib/supabasePdfUpload';

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

const getUsernameFromEmail = (email: string) => {
  return email?.split('@')[0] || email;
};


function StatusPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingWatermark, setDownloadingWatermark] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

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
    if (!user) return;

    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const userDocuments = await getUserDocumentsFromFirestore(user.uid);
        setDocuments(userDocuments);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load your documents. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [user, toast]);

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Document Status Report - ${user?.email}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .user-info { margin-bottom: 20px; }
            .document { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
            .document-header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .document-details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .detail-item { margin-bottom: 8px; }
            .detail-label { font-weight: bold; color: #555; }
            .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .status.approved { background-color: #d4edda; color: #155724; }
            .status.declined { background-color: #f8d7da; color: #721c24; }
            .status.pending { background-color: #e2e3e5; color: #383d41; }
            .print-date { text-align: right; font-size: 12px; color: #666; margin-top: 20px; }
            @media print {
              body { margin: 0; }
              .document { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Document Status Report</h1>
            <div class="user-info">
              <strong>User:</strong> ${user?.email}<br>
              <strong>Generated on:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
          </div>
          
          ${documents.length === 0 ? 
            '<div style="text-align: center; padding: 40px;"><h3>No documents found</h3></div>' :
            documents.map((doc, index) => `
              <div class="document">
                <div class="document-header">${index + 1}. ${doc.name}</div>
                <div class="document-details">
                  <div class="detail-item">
                    <span class="detail-label">Document ID:</span> ${doc.id}
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Status:</span> 
                    <span class="status ${doc.status.toLowerCase()}">${doc.status}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Upload Date:</span> ${new Date(doc.uploadDate).toLocaleDateString()}
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Upload Time:</span> ${new Date(doc.uploadDate).toLocaleTimeString()}
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">File Size:</span> ${doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'N/A'}
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">File Type:</span> ${doc.fileType || 'N/A'}
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Upload Reason:</span> ${doc.reason || 'N/A'}
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Admin Suggestion:</span> ${doc.suggestion || 'N/A'}
                  </div>
                  ${doc.adminDecisionDate && doc.status !== 'Pending' ? `
                    <div class="detail-item">
                      <span class="detail-label">Action Date:</span> ${new Date(doc.adminDecisionDate).toLocaleDateString()}
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Action Time:</span> ${new Date(doc.adminDecisionDate).toLocaleTimeString()}
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Reviewed By:</span> ${doc.adminDecisionBy ? getUsernameFromEmail(doc.adminDecisionBy) : 'N/A'}
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Reviewer Email:</span> ${doc.adminDecisionBy || 'N/A'}
                    </div>
                  ` : `
                    <div class="detail-item">
                      <span class="detail-label">Action Date:</span> Pending Review
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Action Time:</span> Pending Review
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Reviewed By:</span> Pending Review
                    </div>
                  `}
                </div>
              </div>
            `).join('')
          }
          
          <div class="print-date">
            <strong>Total Documents:</strong> ${documents.length}<br>
            <strong>Report Generated:</strong> ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Unable to open print window. Please check your browser settings.",
      });
    }
  };

  const handleIndividualPrint = async (doc: Document) => {
    try {
      showDocumentReport(doc);
    } catch (error) {
      console.error('Individual print error:', error);
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Failed to generate individual document report.",
      });
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (doc.status !== 'Pending') {
      toast({
        variant: 'destructive',
        title: 'Delete not allowed',
        description: 'Only pending documents can be deleted.',
      });
      return;
    }

    const confirmed = window.confirm(`Delete "${doc.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingDocumentId(doc.id);
    try {
      await deletePdfFromSupabase(doc.url);
      await deleteDocumentFromFirestore(doc.id);
      setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
      toast({
        title: 'Document deleted',
        description: `"${doc.name}" was removed.`,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Could not delete the document. Please try again.',
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const showDocumentReport = (doc: Document) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Document Report - ${doc.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.6; 
              background-color: #fff;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #333; 
              padding-bottom: 20px; 
            }
            .document-info { 
              margin-bottom: 30px; 
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 15px; 
              margin-bottom: 20px; 
            }
            .info-item { 
              padding: 15px; 
              border: 1px solid #ddd; 
              border-radius: 5px; 
              background-color: #f9f9f9;
            }
            .info-label { 
              font-weight: bold; 
              color: #555; 
              display: block; 
              margin-bottom: 5px; 
            }
            .info-value { 
              color: #333; 
              font-size: 14px;
            }
            .status { 
              padding: 8px 16px; 
              border-radius: 4px; 
              font-size: 14px; 
              font-weight: bold; 
              display: inline-block; 
            }
            .status.approved { 
              background-color: #d4edda; 
              color: #155724; 
              border: 1px solid #c3e6cb;
            }
            .status.declined { 
              background-color: #f8d7da; 
              color: #721c24; 
              border: 1px solid #f5c6cb;
            }
            .status.pending { 
              background-color: #e2e3e5; 
              color: #383d41; 
              border: 1px solid #d6d8db;
            }
            .document-access { 
              margin-top: 30px; 
              padding: 20px; 
              border: 2px solid #0066cc; 
              border-radius: 10px; 
              background-color: #f0f8ff;
            }
            .document-access h3 {
              color: #0066cc;
              margin-top: 0;
            }
            .document-link { 
              font-size: 16px;
              word-break: break-all;
              background-color: #fff;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 5px;
              margin: 10px 0;
            }
            .print-instructions {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 5px;
              padding: 15px;
              margin-top: 20px;
            }
            .print-instructions h4 {
              color: #856404;
              margin-top: 0;
            }
            .print-footer { 
              text-align: right; 
              font-size: 12px; 
              color: #666; 
              margin-top: 30px; 
              border-top: 1px solid #ddd; 
              padding-top: 10px; 
            }
            @media print {
              body { 
                margin: 0; 
                font-size: 12px; 
              }
              .document-access {
                border-color: #333;
                background-color: #f5f5f5;
              }
              .print-instructions {
                display: none;
              }
            }
            @page {
              size: A4;
              margin: 1cm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Individual Document Report</h1>
            <h2>${doc.name}</h2>
          </div>
          
          <div class="document-info">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Document ID:</span>
                <span class="info-value">${doc.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="status ${doc.status.toLowerCase()}">${doc.status}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Upload Date:</span>
                <span class="info-value">${new Date(doc.uploadDate).toLocaleDateString()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Upload Time:</span>
                <span class="info-value">${new Date(doc.uploadDate).toLocaleTimeString()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">File Size:</span>
                <span class="info-value">${doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">File Type:</span>
                <span class="info-value">${doc.fileType || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Uploaded By:</span>
                <span class="info-value">${doc.userEmail}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Upload Reason:</span>
                <span class="info-value">${doc.reason || 'N/A'}</span>
              </div>
            </div>
            
            ${doc.adminDecisionDate && doc.status !== 'Pending' ? `
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Action Date:</span>
                  <span class="info-value">${new Date(doc.adminDecisionDate).toLocaleDateString()}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Action Time:</span>
                  <span class="info-value">${new Date(doc.adminDecisionDate).toLocaleTimeString()}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Reviewed By:</span>
                  <span class="info-value">${doc.adminDecisionBy ? getUsernameFromEmail(doc.adminDecisionBy) : 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Admin Suggestion:</span>
                  <span class="info-value">${doc.suggestion || 'N/A'}</span>
                </div>
              </div>
            ` : `
              <div class="info-item">
                <span class="info-label">Review Status:</span>
                <span class="info-value">Pending Admin Review</span>
              </div>
            `}
          </div>
          
          <div class="document-access">
            <h3>📄 Document Access</h3>
            <p><strong>Document Link:</strong></p>
            <div class="document-link">
              <a href="${doc.url}" target="_blank" style="color: #0066cc; text-decoration: underline;">
                ${doc.url}
              </a>
            </div>
            
            <div class="print-instructions">
              <h4>📋 For Complete Document Printing:</h4>
              <ol>
                <li><strong>Click the document link above</strong> to open the full document in a new window</li>
                <li><strong>Wait for the document to fully load</strong> in your browser or PDF viewer</li>
                <li><strong>Use Ctrl+P (Windows) or Cmd+P (Mac)</strong> to print the complete document</li>
                <li><strong>Adjust print settings</strong> as needed for best quality</li>
              </ol>
              <p><em>This ensures you get the complete document without any cropping or scrolling issues.</em></p>
            </div>
          </div>
          
          <div class="print-footer">
            <strong>Report Generated:</strong> ${new Date().toLocaleString()}<br>
            <strong>Generated By:</strong> ${user?.email}
          </div>
          
          <script>
            // Auto-open document link when printing
            window.addEventListener('beforeprint', function() {
              window.open('${doc.url}', '_blank');
            });
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 1000);
    } else {
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Unable to open print window. Please check your browser settings.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Document Status</CardTitle>
            <CardDescription>Here is a list of your uploaded documents and their current approval status.</CardDescription>
          </div>
          <Button 
            onClick={handlePrint}
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[15%]">Document Name</TableHead>
                <TableHead className="w-[15%]">Upload Date & Time</TableHead>
                <TableHead className="w-[15%]">Admin Decision</TableHead>
                <TableHead className="w-[20%]">Suggestion</TableHead>
                <TableHead className="w-[10%] text-right">Status</TableHead>
                <TableHead className="w-[10%] text-center">Watermarked</TableHead>
                <TableHead className="w-[15%] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                    <TableCell colSpan={7}>
                       <Skeleton className="h-8 w-full" />
                    </TableCell>
                </TableRow>
              ) : documents.length > 0 ? (
                documents.map((doc: Document) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm leading-5">{doc.name}</div>
                          {doc.reason && (
                            <div className="text-xs text-muted-foreground break-words mt-1">
                              Reason: {doc.reason}
                            </div>
                          )}
                        </div>
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
                      {doc.adminDecisionDate && doc.status !== 'Pending' ? (
                        <div className="text-sm">
                          <div>{new Date(doc.adminDecisionDate).toLocaleDateString()}</div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(doc.adminDecisionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {doc.adminDecisionBy && (
                              <div>by {getUsernameFromEmail(doc.adminDecisionBy)}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">Pending</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{doc.suggestion || '-'}</TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {(doc.status === 'Approved' || doc.status === 'Declined') ? (
                        <Button
                          onClick={() => downloadWatermarkedDocument(doc, doc.status as WatermarkStatus)}
                          variant="outline"
                          size="sm"
                          className={`h-8 w-8 p-0 ${
                            doc.status === 'Approved' 
                              ? 'text-green-600 border-green-200 hover:bg-green-50' 
                              : 'text-red-600 border-red-200 hover:bg-red-50'
                          }`}
                          disabled={downloadingWatermark === doc.id}
                          title={`Download ${doc.status} watermarked PDF`}
                        >
                          {downloadingWatermark === doc.id ? (
                            <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        <Button
                          onClick={() => handleIndividualPrint(doc)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          title="Print Individual Document Report"
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => window.open(doc.url, '_blank')}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          title="View Document"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {doc.status === 'Pending' && (
                          <Button
                            onClick={() => handleDeleteDocument(doc)}
                            variant="destructive"
                            size="sm"
                            className="h-8 w-8 p-0 flex-shrink-0"
                            title="Delete Pending Document"
                            disabled={deletingDocumentId === doc.id}
                          >
                            {deletingDocumentId === doc.id ? (
                              <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                    You have not uploaded any documents yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default withAuth(StatusPage);
