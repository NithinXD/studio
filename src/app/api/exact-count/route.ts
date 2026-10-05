import { NextResponse } from 'next/server';
import { getAllDocumentsFromFirestore } from '@/lib/firebaseService';

export async function GET() {
  try {
    const docs = await getAllDocumentsFromFirestore();
    
    // The exact cutoff date we established (April 30, 2026)
    const splitDate = new Date('2026-04-30T00:00:00.000Z');
    
    let ghostCount = 0;
    let activeCount = 0;

    docs.forEach(doc => {
      if (doc.uploadDate) {
        const docDate = new Date(doc.uploadDate);
        if (docDate < splitDate) {
          ghostCount++;
        } else {
          activeCount++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      total: docs.length,
      ghostCount,
      activeCount
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
