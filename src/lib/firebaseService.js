// src/lib/firebaseService.js
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  getDoc,
  Timestamp
} from 'firebase/firestore';

const DOCUMENTS_COLLECTION = 'documents';

/**
 * Adds a new document record to Firebase Firestore
 * @param {Object} documentData - Document data to store
 * @returns {Promise<string>} Document ID
 */
export async function addDocumentToFirestore(documentData) {
  try {
    const docRef = await addDoc(collection(db, DOCUMENTS_COLLECTION), {
      ...documentData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding document to Firestore:', error);
    throw new Error(`Failed to save document: ${error.message}`);
  }
}

/**
 * Gets all documents from Firebase Firestore
 * @returns {Promise<Array>} Array of documents
 */
export async function getAllDocumentsFromFirestore() {
  try {
    const querySnapshot = await getDocs(collection(db, DOCUMENTS_COLLECTION));
    
    // Get all documents and sort in memory
    const documents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by createdAt or uploadDate in descending order
    return documents.sort((a, b) => {
      const dateA = a.createdAt?.toDate() || new Date(a.uploadDate);
      const dateB = b.createdAt?.toDate() || new Date(b.uploadDate);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting documents from Firestore:', error);
    throw new Error(`Failed to retrieve documents: ${error.message}`);
  }
}

/**
 * Gets documents from the last N months from Firebase Firestore.
 * Uses a server-side Firestore query filter to avoid downloading the entire collection.
 * This reduces network transfer, memory usage, and Firestore read billing.
 * @param {number} monthsBack - Number of months to look back (default: 3)
 * @returns {Promise<Array>} Array of recent documents, sorted newest first
 */
export async function getRecentDocumentsFromFirestore(monthsBack = 3) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    // Query with server-side date filter — only reads matching docs (saves Firestore reads + bandwidth)
    const q = query(
      collection(db, DOCUMENTS_COLLECTION),
      where('createdAt', '>=', cutoffTimestamp),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return documents;
  } catch (error) {
    // If the query fails (e.g. missing index, or old docs without createdAt),
    // fall back to fetching all and filtering client-side
    console.warn('Server-side date filter failed, falling back to client-side filter:', error.message);

    const allDocs = await getAllDocumentsFromFirestore();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsBack);

    return allDocs.filter(doc => {
      const docDate = doc.createdAt?.toDate?.() || new Date(doc.uploadDate);
      return docDate >= cutoff;
    });
  }
}

/**
 * Gets documents for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of user documents
 */
export async function getUserDocumentsFromFirestore(userId) {
  try {
    const q = query(
      collection(db, DOCUMENTS_COLLECTION),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid index requirement
    const documents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by createdAt or uploadDate in descending order
    return documents.sort((a, b) => {
      const dateA = a.createdAt?.toDate() || new Date(a.uploadDate);
      const dateB = b.createdAt?.toDate() || new Date(b.uploadDate);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting user documents from Firestore:', error);
    throw new Error(`Failed to retrieve user documents: ${error.message}`);
  }
}

/**
 * Gets a single document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object|null>} Document data or null if not found
 */
export async function getDocumentFromFirestore(documentId) {
  try {
    const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting document from Firestore:', error);
    throw new Error(`Failed to retrieve document: ${error.message}`);
  }
}

/**
 * Updates a document in Firebase Firestore
 * @param {string} documentId - Document ID
 * @param {Object} updateData - Data to update
 * @param {string} adminEmail - Email of admin making the decision (optional)
 * @returns {Promise<void>}
 */
export async function updateDocumentInFirestore(documentId, updateData, adminEmail = null) {
  try {
    const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
    const updatePayload = {
      ...updateData,
      updatedAt: new Date()
    };
    
    // If status is being updated and adminEmail is provided, track admin decision
    if (updateData.status && adminEmail && updateData.status !== 'Pending') {
      updatePayload.adminDecisionDate = new Date().toISOString();
      updatePayload.adminDecisionBy = adminEmail;
    }
    
    await updateDoc(docRef, updatePayload);
  } catch (error) {
    console.error('Error updating document in Firestore:', error);
    throw new Error(`Failed to update document: ${error.message}`);
  }
}

/**
 * Deletes a document from Firebase Firestore
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
export async function deleteDocumentFromFirestore(documentId) {
  try {
    await deleteDoc(doc(db, DOCUMENTS_COLLECTION, documentId));
  } catch (error) {
    console.error('Error deleting document from Firestore:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}
