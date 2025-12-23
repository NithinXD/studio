
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DocumentReviewClient } from './DocumentReviewClient';
import { withAuth } from '@/hooks/use-auth';
import type { Document } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getDocumentFromFirestore } from '@/lib/firebaseService';
import { useToast } from '@/hooks/use-toast';


function DocumentReviewPage() {
  const { toast } = useToast();
  const params = useParams<{ id?: string | string[] }>();
  const documentId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] ?? '';
    return '';
  }, [params]);
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      setError("No document ID provided.");
      return;
    }

    const fetchDocument = async () => {
      setLoading(true);
      try {
        const doc = await getDocumentFromFirestore(documentId);
        if (doc) {
          setDocument(doc as Document);
        } else {
          setError("Document not found.");
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        setError("Failed to load document. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load document. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId, toast]);


  if (loading) {
    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-16 w-1/2" />
                <Skeleton className="h-[40vh] w-full" />
            </div>
            <div className="lg:col-span-1 space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
  }

  if (error || !document) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold">{error || 'Document Not Found'}</h2>
        <p className="text-muted-foreground">The document you are looking for does not exist or could not be loaded.</p>
        <Button asChild className="mt-4">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return <DocumentReviewClient document={document} />;
}

export default withAuth(DocumentReviewPage, { adminOnly: true });
