import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  writeBatch, 
  onSnapshot, 
  deleteDoc,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Student } from '../types';

const STUDENTS_COLLECTION = 'students';
const CONFIG_DOC_PATH = 'config/settings';

/**
 * Real-time listener for Students collection from Firebase Firestore.
 * Automatically receives live updates whenever student data in Firebase changes.
 */
export const subscribeToStudents = (onData: (students: Student[]) => void, onError?: (err: Error) => void) => {
  const studentsColRef = collection(db, STUDENTS_COLLECTION);
  return onSnapshot(studentsColRef, (snapshot) => {
    const studentsList: Student[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        regNo: data.regNo || '',
        name: data.name || '',
        phone1: data.phone1 || '',
        phone2: data.phone2 || '',
        counsellor: data.counsellor || '',
        year: data.year || '',
        section: data.section || '',
        branch: data.branch || '',
      };
    });
    // Sort students by name or regNo for consistent display
    studentsList.sort((a, b) => a.name.localeCompare(b.name));
    onData(studentsList);
  }, (error) => {
    console.error("Firestore real-time subscription error:", error);
    if (onError) onError(error);
  });
};

/**
 * Real-time listener for Config settings in Firebase Firestore.
 */
export const subscribeToConfig = (onData: (config: { sheetUrl: string; lastUpdated?: string; totalStudents?: number }) => void) => {
  const configRef = doc(db, CONFIG_DOC_PATH);
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      onData({
        sheetUrl: data.sheetUrl || '',
        lastUpdated: data.lastUpdated || '',
        totalStudents: data.totalStudents || 0,
      });
    } else {
      onData({ sheetUrl: '' });
    }
  }, (err) => {
    console.warn("Config listener error:", err);
  });
};

/**
 * Save / Replace all student records in Firebase Cloud Firestore.
 * Replaces existing records in batches of max 400 writes.
 */
export const saveStudentsToFirebase = async (newStudents: Student[], sheetUrl?: string): Promise<void> => {
  try {
    const studentsColRef = collection(db, STUDENTS_COLLECTION);
    
    // 1. Fetch current document IDs to clean up old records
    const currentDocsSnap = await getDocs(studentsColRef);
    
    // Delete old docs in chunks of 400
    const oldDocIds = currentDocsSnap.docs.map(d => d.id);
    for (let i = 0; i < oldDocIds.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = oldDocIds.slice(i, i + 400);
      chunk.forEach(id => {
        batch.delete(doc(db, STUDENTS_COLLECTION, id));
      });
      await batch.commit();
    }

    // 2. Add new docs in chunks of 400
    for (let i = 0; i < newStudents.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = newStudents.slice(i, i + 400);
      chunk.forEach((student, idx) => {
        // Generate a clean doc ID using regNo if present, or index fallback
        const docId = student.regNo ? `st-${student.regNo.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `st-${i + idx}-${Date.now()}`;
        const docRef = doc(db, STUDENTS_COLLECTION, docId);
        batch.set(docRef, {
          regNo: student.regNo || '',
          name: student.name || '',
          phone1: student.phone1 || '',
          phone2: student.phone2 || '',
          counsellor: student.counsellor || '',
          year: student.year || '',
          section: student.section || '',
          branch: student.branch || '',
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }

    // 3. Update global config in Firebase
    const configRef = doc(db, CONFIG_DOC_PATH);
    const configUpdate: any = {
      lastUpdated: new Date().toISOString(),
      totalStudents: newStudents.length
    };
    if (sheetUrl !== undefined) {
      configUpdate.sheetUrl = sheetUrl;
    }
    await setDoc(configRef, configUpdate, { merge: true });

    console.log(`Successfully stored ${newStudents.length} students in Firebase Cloud!`);
  } catch (error) {
    console.error("Error saving students to Firebase:", error);
    throw error;
  }
};

/**
 * Save Google Sheet URL to Firebase Firestore
 */
export const saveSheetUrl = async (url: string): Promise<void> => {
  const configRef = doc(db, CONFIG_DOC_PATH);
  await setDoc(configRef, {
    sheetUrl: url,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
};

/**
 * Fetch student data from Google Sheets CSV, then immediately persist and sync to Firebase.
 */
export const fetchFromGoogleSheets = async (url: string): Promise<Student[]> => {
  try {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) throw new Error("Invalid Google Sheet URL format.");
    
    const spreadsheetId = matches[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Google Sheet access denied. Ensure link sharing is set to 'Anyone with link can view'.");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    const parsedStudents: Student[] = lines.slice(1).filter(line => line.trim()).map((line, index) => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const getVal = (keys: string[]) => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== '') return row[key];
        }
        return '';
      };

      return {
        regNo: getVal(['sid', 'reg no', 'registration', 'regno', 'rno']),
        name: getVal(['sname', 'name', 'student name', 'stuname']),
        phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile']),
        phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile']),
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}`
      };
    });

    // Directly sync to Firebase Firestore!
    await saveStudentsToFirebase(parsedStudents, url);
    return parsedStudents;
  } catch (e) {
    console.error("Google Sheets sync error:", e);
    throw e;
  }
};

/**
 * Add a single new student directly into Firebase Firestore.
 */
export const addStudentToFirebase = async (student: Omit<Student, 'id'>): Promise<string> => {
  const studentsColRef = collection(db, STUDENTS_COLLECTION);
  const docRef = await addDoc(studentsColRef, {
    ...student,
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

/**
 * Update an existing student record in Firebase Firestore.
 */
export const updateStudentInFirebase = async (id: string, updatedFields: Partial<Student>): Promise<void> => {
  const studentDocRef = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(studentDocRef, {
    ...updatedFields,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Delete a student record from Firebase Firestore.
 */
export const deleteStudentFromFirebase = async (id: string): Promise<void> => {
  const studentDocRef = doc(db, STUDENTS_COLLECTION, id);
  await deleteDoc(studentDocRef);
};

export const updateAdminPassword = (newPwd: string) => {
  localStorage.setItem('student_explorer_pwd', newPwd);
};
