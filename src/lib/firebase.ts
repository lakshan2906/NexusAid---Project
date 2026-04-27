import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test Connection
async function testConnection() {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("Firebase Connected Successfully");
  } catch (error) {
    console.error("Firebase Connection Test Failed:", error);
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || (error as any).code === 'unavailable') {
        console.error("Please check your Firebase configuration. The service seems unreachable.");
      }
    }
  }
}
testConnection();
