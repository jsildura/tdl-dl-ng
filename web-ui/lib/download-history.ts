/**
 * Cloud download history module using Firebase Firestore
 * Stores download history globally - all users see all downloads
 */
import { db } from './firebase';
import {
    collection,
    doc,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    setDoc,
    increment,
    getDoc,
    query,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    DocumentSnapshot,
    onSnapshot,
    Unsubscribe
} from 'firebase/firestore';

const COLLECTION_NAME = 'download_history';
const MAX_HISTORY_ITEMS = 50; // Limit displayed items

export interface DownloadHistoryItem {
    id?: string;
    title: string;
    artist: string;
    type: 'Track' | 'Album' | 'Playlist';
    date: string;
    timestamp?: Timestamp;
}

/**
 * Add a download to the cloud history
 */
export async function addDownloadHistory(item: Omit<DownloadHistoryItem, 'id' | 'timestamp'>): Promise<void> {
    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            ...item,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Failed to add download history:', error);
        throw error;
    }
}

/**
 * Get recent downloads from cloud history
 */
export async function getDownloadHistory(maxItems: number = MAX_HISTORY_ITEMS): Promise<DownloadHistoryItem[]> {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('timestamp', 'desc'),
            limit(maxItems)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc: DocumentSnapshot) => ({
            id: doc.id,
            ...doc.data()
        })) as DownloadHistoryItem[];
    } catch (error) {
        console.error('Failed to get download history:', error);
        return [];
    }
}

/**
 * Clear all download history (admin function)
 */
export async function clearDownloadHistory(): Promise<void> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const deletePromises = snapshot.docs.map((doc: DocumentSnapshot) => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Failed to clear download history:', error);
        throw error;
    }
}

/**
 * Subscribe to real-time download history updates
 * Returns an unsubscribe function to stop listening
 */
export function subscribeToDownloadHistory(
    callback: (items: DownloadHistoryItem[]) => void,
    maxItems: number = MAX_HISTORY_ITEMS
): Unsubscribe {
    const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
    );

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        })) as DownloadHistoryItem[];
        callback(items);
    }, (error) => {
        console.error('Error listening to download history:', error);
    });
}

const STATS_COLLECTION = 'stats';
const STATS_DOC_ID = 'general';

/**
 * Increment the total download count
 */
export async function incrementDownloadCount(): Promise<void> {
    const statsRef = doc(db, STATS_COLLECTION, STATS_DOC_ID);
    try {
        await updateDoc(statsRef, {
            total_downloads: increment(1)
        });
    } catch (error: any) {
        // If document doesn't exist (e.g., first run), create it
        if (error.code === 'not-found' || error.message.includes('No document to update')) {
            await setDoc(statsRef, {
                total_downloads: 1
            });
        } else {
            console.error('Failed to increment download count:', error);
            // Don't throw, just log. Counter failure shouldn't stop the app.
        }
    }
}

/**
 * Subscribe to the total download count
 */
export function subscribeToDownloadCount(callback: (count: number) => void): Unsubscribe {
    const statsRef = doc(db, STATS_COLLECTION, STATS_DOC_ID);
    return onSnapshot(statsRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data().total_downloads || 0);
        } else {
            callback(0);
        }
    }, (error) => {
        console.error('Error listening to download count:', error);
    });
}
