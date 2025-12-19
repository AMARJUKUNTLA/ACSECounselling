
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, writeBatch, deleteDoc, query } from 'firebase/firestore';
import { Student } from '../types';

const CONFIG_KEY = 'edubase_firebase_config';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let db: any = null;

export const isCloudConfigured = (): boolean => {
  return !!localStorage.getItem(CONFIG_KEY);
};

export const initCloud = () => {
  const configStr = localStorage.getItem(CONFIG_KEY);
  if (!configStr) return null;

  try {
    const config = JSON.parse(configStr);
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    return true;
  } catch (e) {
    console.error("Cloud Init Failed", e);
    return false;
  }
};

export const saveCloudConfig = (config: FirebaseConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return initCloud();
};

export const getStudentsFromCloud = async (): Promise<Student[]> => {
  if (!db) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "students"));
    return querySnapshot.docs.map(doc => doc.data() as Student);
  } catch (e) {
    console.error("Error fetching cloud data", e);
    return [];
  }
};

export const saveStudentsToCloud = async (students: Student[]) => {
  if (!db) throw new Error("Cloud not configured");
  
  // Using batches for efficiency (Firestore limit is 500 per batch)
  const batchSize = 400;
  for (let i = 0; i < students.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = students.slice(i, i + batchSize);
    
    chunk.forEach(student => {
      const studentRef = doc(db, "students", student.id);
      batch.set(studentRef, student);
    });
    
    await batch.commit();
  }
};

export const clearCloudDatabase = async () => {
  if (!db) return;
  const querySnapshot = await getDocs(collection(db, "students"));
  const batch = writeBatch(db);
  querySnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};
