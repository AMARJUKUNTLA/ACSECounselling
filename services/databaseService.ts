import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  writeBatch, 
  onSnapshot, 
  deleteDoc,
  updateDoc,
  addDoc,
  getDoc,
  query,
  where
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Student, AppUser, StudentRemark } from '../types';

const STUDENTS_COLLECTION = 'students';
const USERS_COLLECTION = 'users';
const REMARKS_COLLECTION = 'remarks';
const CONFIG_DOC_PATH = 'config/settings';

/**
 * Normalizes branch and department names.
 * Treats CSBS and IoT as the same department ("CSBS & IoT").
 */
export const normalizeBranchOrDepartment = (deptOrBranch: string): string => {
  if (!deptOrBranch) return '';
  const trimmed = deptOrBranch.trim();
  const lower = trimmed.toLowerCase();
  
  if (
    lower === 'csbs' || 
    lower === 'iot' || 
    lower === 'csbs & iot' || 
    lower === 'csbs/iot' || 
    lower === 'iot/csbs' || 
    lower === 'csbs, iot' || 
    lower === 'iot, csbs' ||
    lower === 'dept of csbs' ||
    lower === 'dept of iot' ||
    lower === 'dept. of csbs' ||
    lower === 'dept. of iot' ||
    lower === 'computer science and business systems' ||
    lower === 'internet of things'
  ) {
    return 'CSBS & IoT';
  }
  return trimmed;
};

// ==========================================
// 1. STUDENT MANAGEMENT
// ==========================================

export const subscribeToStudents = (
  onData: (students: Student[]) => void, 
  onError?: (err: Error) => void
) => {
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
        branch: normalizeBranchOrDepartment(data.branch || ''),
      };
    });
    studentsList.sort((a, b) => a.name.localeCompare(b.name));
    onData(studentsList);
  }, (error) => {
    console.error("Firestore real-time subscription error:", error);
    if (onError) onError(error);
  });
};

export const saveStudentsToFirebase = async (newStudents: Student[], sheetUrl?: string): Promise<void> => {
  try {
    const studentsColRef = collection(db, STUDENTS_COLLECTION);
    const currentDocsSnap = await getDocs(studentsColRef);
    
    const oldDocIds = currentDocsSnap.docs.map(d => d.id);
    for (let i = 0; i < oldDocIds.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = oldDocIds.slice(i, i + 400);
      chunk.forEach(id => {
        batch.delete(doc(db, STUDENTS_COLLECTION, id));
      });
      await batch.commit();
    }

    for (let i = 0; i < newStudents.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = newStudents.slice(i, i + 400);
      chunk.forEach((student, idx) => {
        const docId = student.regNo 
          ? `st-${student.regNo.replace(/[^a-zA-Z0-9_-]/g, '_')}` 
          : `st-${i + idx}-${Date.now()}`;
        const docRef = doc(db, STUDENTS_COLLECTION, docId);
        batch.set(docRef, {
          regNo: student.regNo || '',
          name: student.name || '',
          phone1: student.phone1 || '',
          phone2: student.phone2 || '',
          counsellor: student.counsellor || '',
          year: student.year || '',
          section: student.section || '',
          branch: normalizeBranchOrDepartment(student.branch || ''),
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }

    const configRef = doc(db, CONFIG_DOC_PATH);
    const configUpdate: any = {
      lastUpdated: new Date().toISOString(),
      totalStudents: newStudents.length
    };
    if (sheetUrl !== undefined) {
      configUpdate.sheetUrl = sheetUrl;
    }
    await setDoc(configRef, configUpdate, { merge: true });

    // Automatically generate faculty user accounts for all unique counsellors in data
    await syncCounsellorAccountsFromStudents(newStudents);
  } catch (error) {
    console.error("Error saving students to Firebase:", error);
    throw error;
  }
};

export const addStudentToFirebase = async (student: Omit<Student, 'id'>): Promise<string> => {
  const studentsColRef = collection(db, STUDENTS_COLLECTION);
  const docRef = await addDoc(studentsColRef, {
    ...student,
    updatedAt: new Date().toISOString()
  });

  if (student.counsellor) {
    await syncCounsellorAccountsFromStudents();
  }

  return docRef.id;
};

export const updateStudentInFirebase = async (id: string, updatedFields: Partial<Student>): Promise<void> => {
  const studentDocRef = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(studentDocRef, {
    ...updatedFields,
    updatedAt: new Date().toISOString()
  });
};

export const deleteStudentFromFirebase = async (id: string): Promise<void> => {
  const studentDocRef = doc(db, STUDENTS_COLLECTION, id);
  await deleteDoc(studentDocRef);
};

// ==========================================
// 2. USER AUTH & FACULTY / ADMIN MANAGEMENT
// ==========================================

export const subscribeToUsers = (onData: (users: AppUser[]) => void) => {
  const usersColRef = collection(db, USERS_COLLECTION);
  return onSnapshot(usersColRef, (snapshot) => {
    const userList: AppUser[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        email: data.email || '',
        name: data.name || '',
        role: (data.role as 'admin' | 'faculty') || 'faculty',
        department: data.department || '',
        phone: data.phone || '',
        createdAt: data.createdAt || ''
      };
    });
    userList.sort((a, b) => a.name.localeCompare(b.name));
    onData(userList);
  });
};

/**
 * Seed default accounts in Firestore if none exist.
 */
export const seedDefaultUsersIfEmpty = async () => {
  try {
    const usersColRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersColRef);
    if (snap.empty) {
      console.log("Seeding default Admin & Faculty accounts in Firestore...");
      
      const adminDoc = doc(db, USERS_COLLECTION, 'admin-default');
      await setDoc(adminDoc, {
        email: 'admin@edubase.edu',
        name: 'System Administrator',
        role: 'admin',
        department: 'Administration',
        password: 'admin123',
        createdAt: new Date().toISOString()
      });

      const facultyDoc = doc(db, USERS_COLLECTION, 'faculty-default');
      await setDoc(facultyDoc, {
        email: 'faculty@edubase.edu',
        name: 'Dr. Rahul Sharma',
        role: 'faculty',
        department: 'CSE Department',
        password: 'faculty123',
        createdAt: new Date().toISOString()
      });

      // Try creating them in Firebase Auth
      try {
        await createUserWithEmailAndPassword(auth, 'admin@edubase.edu', 'admin123');
      } catch (e) { /* ignore if already exists */ }
      try {
        await createUserWithEmailAndPassword(auth, 'faculty@edubase.edu', 'faculty123');
      } catch (e) { /* ignore if already exists */ }
    }
  } catch (err) {
    console.warn("User seeding error:", err);
  }
};

/**
 * Automatically create faculty user accounts for counsellors listed in student data.
 */
export const syncCounsellorAccountsFromStudents = async (studentsList?: Student[]): Promise<number> => {
  try {
    let targetStudents = studentsList;
    if (!targetStudents || targetStudents.length === 0) {
      const studentsColRef = collection(db, STUDENTS_COLLECTION);
      const snap = await getDocs(studentsColRef);
      targetStudents = snap.docs.map(docSnap => docSnap.data() as Student);
    }

    if (!targetStudents || targetStudents.length === 0) return 0;

    // Extract unique counsellor names
    const counsellorNamesSet = new Set<string>();
    targetStudents.forEach(s => {
      const name = (s.counsellor || '').trim();
      if (name && 
          name.toLowerCase() !== 'unassigned' && 
          name.toLowerCase() !== 'not assigned' && 
          name.toLowerCase() !== 'none' &&
          name.toLowerCase() !== 'n/a') {
        counsellorNamesSet.add(name);
      }
    });

    if (counsellorNamesSet.size === 0) return 0;

    // Fetch existing users
    const usersColRef = collection(db, USERS_COLLECTION);
    const existingUsersSnap = await getDocs(usersColRef);
    const existingUsers = existingUsersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    let createdCount = 0;

    for (const cName of Array.from(counsellorNamesSet)) {
      // Find branch/department from student data for this counsellor
      const counsellorStudents = targetStudents.filter(s => (s.counsellor || '').trim().toLowerCase() === cName.toLowerCase());
      const branches = Array.from(new Set(counsellorStudents.map(s => normalizeBranchOrDepartment(s.branch || '')).filter(Boolean)));
      const counsellorDept = branches.length > 0 ? (branches.length === 1 ? `Dept. of ${branches[0]}` : branches.join(', ')) : 'Faculty Counsellor / Mentor';

      // Check if user already exists with matching name or email
      const existingUser = existingUsers.find(u => 
        (u.name && u.name.trim().toLowerCase() === cName.toLowerCase()) ||
        (u.counsellorName && u.counsellorName.trim().toLowerCase() === cName.toLowerCase())
      );

      if (!existingUser) {
        // Create faculty account for this counsellor
        const sanitizedSlug = cName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        const email = `${sanitizedSlug}@edubase.edu`;
        const docId = `usr-counsellor-${sanitizedSlug}`;
        const defaultPassword = 'faculty123';

        const userDocRef = doc(db, USERS_COLLECTION, docId);
        await setDoc(userDocRef, {
          name: cName,
          counsellorName: cName,
          email: email,
          role: 'faculty',
          department: counsellorDept,
          password: defaultPassword,
          isAutoCounsellor: true,
          createdAt: new Date().toISOString()
        });

        // Try creating in Firebase Auth
        try {
          await createUserWithEmailAndPassword(auth, email, defaultPassword);
        } catch (authErr) {
          // Ignore if auth account already exists
        }

        createdCount++;
      } else {
        // If user exists but department is generic, update department from student data
        if (counsellorDept !== 'Faculty Counsellor / Mentor' && 
            (!existingUser.department || existingUser.department === 'Faculty Counsellor / Mentor' || existingUser.department === 'Faculty Member')) {
          const userDocRef = doc(db, USERS_COLLECTION, existingUser.id);
          await setDoc(userDocRef, { department: counsellorDept }, { merge: true });
        }
      }
    }

    return createdCount;
  } catch (err) {
    console.error("Error syncing counsellor accounts:", err);
    return 0;
  }
};

/**
 * Authenticate User by Email / Username / Counsellor Name & Password
 */
export const loginUser = async (emailOrUser: string, passwordInput: string): Promise<AppUser> => {
  await seedDefaultUsersIfEmpty();

  const formattedInput = emailOrUser.trim().toLowerCase();
  const searchEmail = formattedInput.includes('@') ? formattedInput : `${formattedInput}@edubase.edu`;

  // Fetch all users in USERS_COLLECTION to support flexible login by email or name
  const usersColRef = collection(db, USERS_COLLECTION);
  const snap = await getDocs(usersColRef);
  const allUsers = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() as any }));

  // Find user match by email, full name (case insensitive), or email prefix
  const matchedUser = allUsers.find(u => {
    const userEmail = (u.email || '').toLowerCase();
    const userName = (u.name || '').toLowerCase();
    const userPrefix = userEmail.split('@')[0];
    
    return userEmail === formattedInput || 
           userEmail === searchEmail || 
           userName === formattedInput ||
           userPrefix === formattedInput;
  });

  if (matchedUser) {
    if (matchedUser.password && matchedUser.password !== passwordInput) {
      throw new Error("Invalid password. Please check your credentials.");
    }

    const emailToAuth = matchedUser.email || searchEmail;
    try {
      await signInWithEmailAndPassword(auth, emailToAuth, passwordInput);
    } catch (e) {
      try {
        await createUserWithEmailAndPassword(auth, emailToAuth, passwordInput);
      } catch (e2) {
        // Continue with Firestore document session
      }
    }

    return {
      id: matchedUser.id,
      email: matchedUser.email,
      name: matchedUser.name,
      role: (matchedUser.role as 'admin' | 'faculty') || 'faculty',
      department: matchedUser.department || '',
      phone: matchedUser.phone || '',
      createdAt: matchedUser.createdAt
    };
  }

  // 2. Fallback: Check default hardcoded accounts
  if (formattedInput === 'admin' && passwordInput === 'admin123') {
    return {
      id: 'admin-default',
      email: 'admin@edubase.edu',
      name: 'System Administrator',
      role: 'admin',
      department: 'Administration'
    };
  }
  if (formattedInput === 'faculty' && passwordInput === 'faculty123') {
    return {
      id: 'faculty-default',
      email: 'faculty@edubase.edu',
      name: 'Dr. Rahul Sharma',
      role: 'faculty',
      department: 'Computer Science'
    };
  }

  throw new Error("Invalid credentials. Account not found in Authorized Users directory.");
};

/**
 * Add new user account (Faculty or Admin) into Firebase Cloud.
 */
export const addUserToFirebase = async (userData: {
  name: string;
  email: string;
  role: 'admin' | 'faculty';
  department?: string;
  phone?: string;
  password?: string;
}): Promise<string> => {
  const email = userData.email.trim().toLowerCase();
  const password = userData.password || (userData.role === 'admin' ? 'admin123' : 'faculty123');
  
  // Create user record in Firestore
  const customDocId = `usr-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const userDocRef = doc(db, USERS_COLLECTION, customDocId);
  
  await setDoc(userDocRef, {
    name: userData.name.trim(),
    email: email,
    role: userData.role,
    department: userData.department || '',
    phone: userData.phone || '',
    password: password,
    createdAt: new Date().toISOString()
  });

  // Attempt creating in Firebase Auth
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.warn("Firebase Auth account creation notice:", e);
  }

  return customDocId;
};

/**
 * Delete a user account (Faculty or Admin) from Firebase.
 */
export const deleteUserFromFirebase = async (userId: string): Promise<void> => {
  const userDocRef = doc(db, USERS_COLLECTION, userId);
  await deleteDoc(userDocRef);
};

export const logoutUserFromFirebase = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.warn("Logout error:", e);
  }
};

// ==========================================
// 3. STUDENT REMARKS & COUNSELING NOTES
// ==========================================

export const subscribeToRemarksForStudent = (studentId: string, onData: (remarks: StudentRemark[]) => void) => {
  const remarksColRef = collection(db, REMARKS_COLLECTION);
  const q = query(remarksColRef, where("studentId", "==", studentId));
  
  return onSnapshot(q, (snapshot) => {
    const list: StudentRemark[] = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        studentId: d.studentId,
        studentRegNo: d.studentRegNo || '',
        studentName: d.studentName || '',
        facultyId: d.facultyId || '',
        facultyName: d.facultyName || 'Faculty',
        category: d.category || 'counseling',
        remark: d.remark || '',
        createdAt: d.createdAt || new Date().toISOString()
      };
    });
    // Sort descending by date
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onData(list);
  });
};

export const subscribeToAllRemarks = (onData: (remarks: StudentRemark[]) => void) => {
  const remarksColRef = collection(db, REMARKS_COLLECTION);
  return onSnapshot(remarksColRef, (snapshot) => {
    const list: StudentRemark[] = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        studentId: d.studentId,
        studentRegNo: d.studentRegNo || '',
        studentName: d.studentName || '',
        facultyId: d.facultyId || '',
        facultyName: d.facultyName || 'Faculty',
        category: d.category || 'counseling',
        remark: d.remark || '',
        createdAt: d.createdAt || new Date().toISOString()
      };
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onData(list);
  });
};

export const addRemarkToFirebase = async (remarkData: {
  studentId: string;
  studentRegNo: string;
  studentName?: string;
  facultyId: string;
  facultyName: string;
  category: 'counseling' | 'discipline' | 'attendance' | 'academic' | 'general';
  remark: string;
}): Promise<string> => {
  const remarksColRef = collection(db, REMARKS_COLLECTION);
  const docRef = await addDoc(remarksColRef, {
    ...remarkData,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};

export const deleteRemarkFromFirebase = async (remarkId: string): Promise<void> => {
  const docRef = doc(db, REMARKS_COLLECTION, remarkId);
  await deleteDoc(docRef);
};

// ==========================================
// 4. CONFIG & GOOGLE SHEET SYNC
// ==========================================

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
  });
};

export const saveSheetUrl = async (url: string): Promise<void> => {
  const configRef = doc(db, CONFIG_DOC_PATH);
  await setDoc(configRef, {
    sheetUrl: url,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
};

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
        regNo: getVal(['sid', 'reg no', 'registration', 'regno', 'rno', 'rollno', 'roll no', 'htno', 'hallticket']),
        name: getVal(['sname', 'name', 'student name', 'stuname', 'full name']),
        phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile', 'mobile']),
        phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile', 'parent mobile']),
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor', 'faculty advisor', 'guide']),
        year: getVal(['year', 'academic year', 'yr', 'class']),
        section: getVal(['section', 'sec']),
        branch: normalizeBranchOrDepartment(getVal(['branch', 'dept', 'department', 'dep', 'br', 'stream', 'course', 'discipline', 'department name', 'dept name', 'branch name'])),
        id: `gs-${index}`
      };
    });

    await saveStudentsToFirebase(parsedStudents, url);
    return parsedStudents;
  } catch (e) {
    console.error("Google Sheets sync error:", e);
    throw e;
  }
};
