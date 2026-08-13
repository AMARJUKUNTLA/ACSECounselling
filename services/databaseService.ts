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

const LOCAL_STORAGE_KEYS = {
  STUDENTS: 'edubase_local_students_cache',
  USERS: 'edubase_local_users_cache',
  REMARKS: 'edubase_local_remarks_cache',
  CONFIG: 'edubase_local_config_cache'
};

// Quota State & Listeners
let isQuotaExceededState = false;
const quotaListeners = new Set<(isExceeded: boolean) => void>();

export const checkIsQuotaExceeded = () => isQuotaExceededState;

export const subscribeToQuotaStatus = (callback: (isExceeded: boolean) => void) => {
  quotaListeners.add(callback);
  callback(isQuotaExceededState);
  return () => {
    quotaListeners.delete(callback);
  };
};

export const isQuotaError = (err: any): boolean => {
  if (!err) return false;
  const str = String(err.message || err.code || err).toLowerCase();
  return (
    err.code === 'resource-exhausted' ||
    str.includes('resource-exhausted') ||
    str.includes('quota limit exceeded') ||
    str.includes('quota exceeded') ||
    str.includes('free tier database')
  );
};

const notifyQuotaExceeded = () => {
  if (!isQuotaExceededState) {
    isQuotaExceededState = true;
    console.warn("⚠️ Firestore Quota Exceeded detected. Switched to Local Cache mode.");
    quotaListeners.forEach(cb => cb(true));
  }
};

// Safe LocalStorage helpers
const getLocalStorage = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const setLocalStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage write error:", e);
  }
};

/**
 * Normalizes program / branch names.
 * Offered programs in Dept. of CSBS & IoT: B.Tech CSBS and B.Tech CSE(IoT).
 */
export const normalizeProgramBranch = (branchInput: string): string => {
  if (!branchInput || !branchInput.trim() || branchInput.trim() === 'Not Assigned') return 'B.Tech CSBS';
  const trimmed = branchInput.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower === 'csbs' || 
    lower === 'b.tech csbs' ||
    lower === 'btech csbs' ||
    lower === 'b.tech - csbs' ||
    lower === 'computer science and business systems' || 
    lower === 'computer science & business systems'
  ) {
    return 'B.Tech CSBS';
  }

  if (
    lower === 'iot' || 
    lower === 'cse(iot)' ||
    lower === 'cse (iot)' ||
    lower === 'cse-iot' ||
    lower === 'b.tech cse(iot)' ||
    lower === 'b.tech cse (iot)' ||
    lower === 'btech cse(iot)' ||
    lower === 'b.tech iot' ||
    lower === 'btech iot' ||
    lower === 'internet of things' || 
    lower === 'internet-of-things'
  ) {
    return 'B.Tech CSE(IoT)';
  }

  if (lower === 'csbs & iot' || lower === 'csbs/iot' || lower === 'iot/csbs' || lower.includes('csbs & iot')) {
    return 'B.Tech CSBS & CSE(IoT)';
  }

  return trimmed;
};

/**
 * Returns the overarching Department name for a given program or branch.
 * Department name: 'Dept. of CSBS & IoT' for offered programs B.Tech CSBS and B.Tech CSE(IoT).
 */
export const getDepartmentForBranch = (branchOrDept: string): string => {
  if (!branchOrDept || !branchOrDept.trim() || branchOrDept === 'Not Assigned' || branchOrDept === 'General Faculty') {
    return 'Dept. of CSBS & IoT';
  }
  const program = normalizeProgramBranch(branchOrDept);
  const lower = program.toLowerCase();

  if (lower.includes('csbs') || lower.includes('iot') || lower.includes('cse')) {
    return 'Dept. of CSBS & IoT';
  }

  if (lower.startsWith('dept') || lower.startsWith('department')) {
    return branchOrDept;
  }

  return `Dept. of ${program}`;
};

export const sanitizeSubjectAttendance = (raw?: Record<string, string>): Record<string, string> => {
  if (!raw || typeof raw !== 'object') return {};
  const cleaned: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    const cleanKey = (key || '').trim().replace(/[\.~*\[\]]/g, '_');
    if (cleanKey && cleanKey.length > 0) {
      cleaned[cleanKey] = val !== undefined && val !== null ? String(val).trim() : '';
    }
  }
  return cleaned;
};

// ==========================================
// 1. STUDENT MANAGEMENT
// ==========================================

export const subscribeToStudents = (
  onData: (students: Student[]) => void, 
  onError?: (err: Error) => void
) => {
  // Immediately serve cached students if present
  const cachedStudents = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  if (cachedStudents.length > 0) {
    onData(cachedStudents);
  }

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
        branch: normalizeProgramBranch(data.branch || ''),
        cgpa: data.cgpa || '',
        attendance: data.attendance || '',
        rGrade: data.rGrade || '',
        rGradeCount: data.rGradeCount ?? '',
        iGrade: data.iGrade || '',
        iGradeCredits: data.iGradeCredits ?? '',
        subjectAttendance: data.subjectAttendance || {}
      };
    });
    studentsList.sort((a, b) => a.name.localeCompare(b.name));
    setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, studentsList);
    onData(studentsList);
  }, (error) => {
    console.warn("Firestore real-time subscription notice:", error);
    if (isQuotaError(error)) {
      notifyQuotaExceeded();
    }
    const fallback = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
    onData(fallback);
    if (onError) onError(error);
  });
};

export const saveStudentsToFirebase = async (newStudents: Student[], sheetUrl?: string): Promise<void> => {
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, newStudents);

  if (isQuotaExceededState) {
    console.warn("Quota exceeded: Saved students to local cache only.");
    return;
  }

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
          branch: normalizeProgramBranch(student.branch || ''),
          cgpa: student.cgpa || '',
          attendance: student.attendance || '',
          rGrade: student.rGrade || '',
          rGradeCount: student.rGradeCount ?? '',
          iGrade: student.iGrade || '',
          iGradeCredits: student.iGradeCredits ?? '',
          subjectAttendance: sanitizeSubjectAttendance(student.subjectAttendance),
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
    if (isQuotaError(error)) {
      notifyQuotaExceeded();
      console.warn("Firestore Quota exceeded while saving students. Kept in local cache.");
      return;
    }
    console.error("Error saving students to Firebase:", error);
    throw error;
  }
};

export const addStudentToFirebase = async (student: Omit<Student, 'id'>): Promise<string> => {
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const tempId = `st-local-${Date.now()}`;
  const newStudentRecord: Student = { ...student, id: tempId, branch: normalizeProgramBranch(student.branch || '') };
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, [newStudentRecord, ...localList]);

  if (isQuotaExceededState) {
    return tempId;
  }

  try {
    const studentsColRef = collection(db, STUDENTS_COLLECTION);
    const docRef = await addDoc(studentsColRef, {
      ...student,
      subjectAttendance: sanitizeSubjectAttendance(student.subjectAttendance),
      updatedAt: new Date().toISOString()
    });

    if (student.counsellor) {
      await syncCounsellorAccountsFromStudents();
    }

    return docRef.id;
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return tempId;
    }
    throw e;
  }
};

export const updateStudentInFirebase = async (id: string, updatedFields: Partial<Student>): Promise<void> => {
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const updatedList = localList.map(s => s.id === id ? { ...s, ...updatedFields } : s);
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedList);

  if (isQuotaExceededState) return;

  try {
    const studentDocRef = doc(db, STUDENTS_COLLECTION, id);
    const fieldsToUpdate: any = {
      ...updatedFields,
      updatedAt: new Date().toISOString()
    };
    if (updatedFields.subjectAttendance) {
      fieldsToUpdate.subjectAttendance = sanitizeSubjectAttendance(updatedFields.subjectAttendance);
    }
    await updateDoc(studentDocRef, fieldsToUpdate);
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return;
    }
    throw e;
  }
};

export const deleteStudentFromFirebase = async (id: string): Promise<void> => {
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, localList.filter(s => s.id !== id));

  if (isQuotaExceededState) return;

  try {
    const studentDocRef = doc(db, STUDENTS_COLLECTION, id);
    await deleteDoc(studentDocRef);
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return;
    }
    throw e;
  }
};

// ==========================================
// 2. USER AUTH & FACULTY / ADMIN MANAGEMENT
// ==========================================

export const subscribeToUsers = (onData: (users: AppUser[]) => void) => {
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  if (cachedUsers.length > 0) {
    onData(cachedUsers);
  }

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
        password: data.password || 'faculty123',
        createdAt: data.createdAt || ''
      };
    });
    userList.sort((a, b) => a.name.localeCompare(b.name));
    setLocalStorage(LOCAL_STORAGE_KEYS.USERS, userList);
    onData(userList);
  }, (error) => {
    if (isQuotaError(error)) {
      notifyQuotaExceeded();
    }
    const fallback = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
    onData(fallback);
  });
};

/**
 * Seed default accounts in Firestore if none exist.
 */
export const seedDefaultUsersIfEmpty = async () => {
  if (isQuotaExceededState) return;

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
        department: 'Dept. of CSBS & IoT',
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
    if (isQuotaError(err)) {
      notifyQuotaExceeded();
    } else {
      console.warn("User seeding error:", err);
    }
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
      const branches = Array.from(new Set(counsellorStudents.map(s => normalizeProgramBranch(s.branch || '')).filter(Boolean)));
      const depts = Array.from(new Set(branches.map(b => getDepartmentForBranch(b))));
      const counsellorDept = depts.length > 0 ? (depts.length === 1 ? depts[0] : depts.join(', ')) : 'Dept. of CSBS & IoT';

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

  let allUsers: any[] = [];
  if (!isQuotaExceededState) {
    try {
      const usersColRef = collection(db, USERS_COLLECTION);
      const snap = await getDocs(usersColRef);
      allUsers = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() as any }));
    } catch (e) {
      if (isQuotaError(e)) notifyQuotaExceeded();
      allUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
    }
  } else {
    allUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  }

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
    if (!isQuotaExceededState) {
      try {
        await signInWithEmailAndPassword(auth, emailToAuth, passwordInput);
      } catch (e) {
        try {
          await createUserWithEmailAndPassword(auth, emailToAuth, passwordInput);
        } catch (e2) {
          // Continue
        }
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

  // Fallback: Check default hardcoded accounts
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
      department: 'Dept. of CSBS & IoT'
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
  
  const customDocId = `usr-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const newUser: AppUser = {
    id: customDocId,
    name: userData.name.trim(),
    email: email,
    role: userData.role,
    department: userData.department || 'Dept. of CSBS & IoT',
    phone: userData.phone || '',
    password: password,
    createdAt: new Date().toISOString()
  };

  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  setLocalStorage(LOCAL_STORAGE_KEYS.USERS, [...cachedUsers, newUser]);

  if (isQuotaExceededState) return customDocId;

  try {
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

    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      console.warn("Firebase Auth account creation notice:", e);
    }

    return customDocId;
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return customDocId;
    }
    throw e;
  }
};

/**
 * Update an existing user account (Faculty or Admin) in Firebase Cloud.
 */
export const updateUserInFirebase = async (
  userId: string,
  updatedFields: Partial<{
    name: string;
    email: string;
    role: 'admin' | 'faculty';
    department: string;
    phone: string;
    password: string;
    counsellorName?: string;
  }>
): Promise<void> => {
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  setLocalStorage(LOCAL_STORAGE_KEYS.USERS, cachedUsers.map(u => u.id === userId ? { ...u, ...updatedFields } : u));

  if (isQuotaExceededState) return;

  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userDocRef, {
      ...updatedFields,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return;
    }
    throw e;
  }
};

/**
 * Delete a user account (Faculty or Admin) from Firebase.
 */
export const deleteUserFromFirebase = async (userId: string): Promise<void> => {
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  setLocalStorage(LOCAL_STORAGE_KEYS.USERS, cachedUsers.filter(u => u.id !== userId));

  if (isQuotaExceededState) return;

  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(userDocRef);
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return;
    }
    throw e;
  }
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
  const cachedAll = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  onData(cachedAll.filter(r => r.studentId === studentId));

  if (isQuotaExceededState) return () => {};

  try {
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
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    }, (err) => {
      if (isQuotaError(err)) notifyQuotaExceeded();
    });
  } catch (err) {
    if (isQuotaError(err)) notifyQuotaExceeded();
    return () => {};
  }
};

export const subscribeToAllRemarks = (onData: (remarks: StudentRemark[]) => void) => {
  const cachedAll = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  if (cachedAll.length > 0) onData(cachedAll);

  if (isQuotaExceededState) return () => {};

  try {
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
      setLocalStorage(LOCAL_STORAGE_KEYS.REMARKS, list);
      onData(list);
    }, (err) => {
      if (isQuotaError(err)) notifyQuotaExceeded();
    });
  } catch (err) {
    if (isQuotaError(err)) notifyQuotaExceeded();
    return () => {};
  }
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
  const cached = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  const tempId = `rem-local-${Date.now()}`;
  const newRemark: StudentRemark = {
    ...remarkData,
    id: tempId,
    createdAt: new Date().toISOString()
  };
  setLocalStorage(LOCAL_STORAGE_KEYS.REMARKS, [newRemark, ...cached]);

  if (isQuotaExceededState) return tempId;

  try {
    const remarksColRef = collection(db, REMARKS_COLLECTION);
    const docRef = await addDoc(remarksColRef, {
      ...remarkData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return tempId;
    }
    throw e;
  }
};

export const deleteRemarkFromFirebase = async (remarkId: string): Promise<void> => {
  const cached = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  setLocalStorage(LOCAL_STORAGE_KEYS.REMARKS, cached.filter(r => r.id !== remarkId));

  if (isQuotaExceededState) return;

  try {
    const docRef = doc(db, REMARKS_COLLECTION, remarkId);
    await deleteDoc(docRef);
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return;
    }
    throw e;
  }
};

// ==========================================
// 4. CONFIG & GOOGLE SHEET SYNC
// ==========================================

export const subscribeToConfig = (onData: (config: { 
  sheetUrl: string; 
  lastUpdated?: string; 
  totalStudents?: number;
  departmentName?: string;
  offeredCourses?: string[];
}) => void) => {
  const cachedConfig = getLocalStorage<{ 
    sheetUrl: string; 
    lastUpdated?: string; 
    totalStudents?: number;
    departmentName?: string;
    offeredCourses?: string[];
  }>(LOCAL_STORAGE_KEYS.CONFIG, { 
    sheetUrl: '',
    departmentName: 'Dept. of CSBS & IoT',
    offeredCourses: ['B.Tech CSBS', 'B.Tech CSE(IoT)']
  });
  onData(cachedConfig);

  if (isQuotaExceededState) return () => {};

  try {
    const configRef = doc(db, CONFIG_DOC_PATH);
    return onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const cfg = {
          sheetUrl: data.sheetUrl || '',
          lastUpdated: data.lastUpdated || '',
          totalStudents: data.totalStudents || 0,
          departmentName: data.departmentName || 'Dept. of CSBS & IoT',
          offeredCourses: data.offeredCourses || ['B.Tech CSBS', 'B.Tech CSE(IoT)']
        };
        setLocalStorage(LOCAL_STORAGE_KEYS.CONFIG, cfg);
        onData(cfg);
      }
    }, (err) => {
      if (isQuotaError(err)) notifyQuotaExceeded();
    });
  } catch (err) {
    if (isQuotaError(err)) notifyQuotaExceeded();
    return () => {};
  }
};

export const saveSheetUrl = async (
  url: string, 
  extraConfig?: { departmentName?: string; offeredCourses?: string[]; totalStudents?: number }
): Promise<void> => {
  const cachedConfig = getLocalStorage<any>(LOCAL_STORAGE_KEYS.CONFIG, {});
  const newConfig = { 
    ...cachedConfig, 
    sheetUrl: url, 
    lastUpdated: new Date().toISOString(),
    departmentName: extraConfig?.departmentName || cachedConfig.departmentName || 'Dept. of CSBS & IoT',
    offeredCourses: extraConfig?.offeredCourses || cachedConfig.offeredCourses || ['B.Tech CSBS', 'B.Tech CSE(IoT)'],
    totalStudents: extraConfig?.totalStudents ?? cachedConfig.totalStudents ?? 0
  };
  setLocalStorage(LOCAL_STORAGE_KEYS.CONFIG, newConfig);

  if (isQuotaExceededState) return;

  try {
    const configRef = doc(db, CONFIG_DOC_PATH);
    await setDoc(configRef, {
      sheetUrl: url,
      lastUpdated: new Date().toISOString(),
      departmentName: newConfig.departmentName,
      offeredCourses: newConfig.offeredCourses,
      totalStudents: newConfig.totalStudents
    }, { merge: true });
  } catch (e) {
    if (isQuotaError(e)) notifyQuotaExceeded();
  }
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
    
    // Check if headers or spreadsheet metadata contain custom department name
    let extractedDeptName = 'Dept. of CSBS & IoT';
    const deptHeaderVal = headers.find(h => h.includes('dept') || h.includes('department'));
    if (deptHeaderVal) {
      extractedDeptName = 'Dept. of CSBS & IoT';
    }

    const coursesFound = new Set<string>();

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

      const subjectAttendance: Record<string, string> = {};
      const knownKeys = new Set([
        'reg.no', 'reg no', 'student name', 'year', 'section', 'cgpa', 'r-grade', 
        'no.of r-grade courses', 'i-grade', 'no.of credits in i-grade', 'counsellor name', 
        'sphno', 'fphno', 'attendance', 'sid', 'registration', 'regno', 'rno', 'rollno', 'htno',
        'sname', 'name', 'stuname', 'full name', 'phone1', 'phone2', 'cname', 'counsellor', 'mentor', 'branch', 'dept'
      ]);
      headers.forEach((h, i) => {
        const cleanHeader = (h || '').trim().toLowerCase();
        if (cleanHeader && !knownKeys.has(cleanHeader) && values[i] !== undefined && values[i] !== '') {
          const keyUpper = (h || '').trim().toUpperCase().replace(/[\.~*\[\]]/g, '_');
          if (keyUpper && keyUpper.length > 0) {
            subjectAttendance[keyUpper] = values[i].trim();
          }
        }
      });

      const rawBranch = getVal(['branch', 'dept', 'department', 'dep', 'br', 'stream', 'course', 'discipline', 'department name', 'dept name', 'branch name']) || 'CSBS';
      const normBranch = normalizeProgramBranch(rawBranch);
      coursesFound.add(normBranch);

      return {
        regNo: getVal(['sid', 'reg.no', 'reg no', 'registration', 'regno', 'rno', 'rollno', 'roll no', 'htno', 'hallticket']),
        name: getVal(['sname', 'name', 'student name', 'stuname', 'full name']),
        phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile', 'mobile']),
        phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile', 'parent mobile']),
        counsellor: getVal(['cname', 'counsellor name', 'counante', 'counsellor', 'mentor', 'faculty advisor', 'guide']),
        year: getVal(['year', 'academic year', 'yr', 'class']),
        section: getVal(['section', 'sec']),
        branch: normBranch,
        cgpa: getVal(['cgpa', 'gpa', 'cumulative gpa']),
        attendance: getVal(['attendance', 'att', 'attendance %', 'overall attendance']),
        rGrade: getVal(['r-grade', 'rgrade', 'r grade']),
        rGradeCount: getVal(['no.of r-grade courses', 'rgradecount', 'no of r grade courses', 'r-grade count']),
        iGrade: getVal(['i-grade', 'igrade', 'i grade']),
        iGradeCredits: getVal(['no.of credits in i-grade', 'igradecredits', 'no of credits in i grade', 'i-grade credits']),
        subjectAttendance,
        id: `gs-${index}`
      };
    });

    // Ensure offered courses contains both B.Tech CSBS & B.Tech CSE(IoT)
    coursesFound.add('B.Tech CSBS');
    coursesFound.add('B.Tech CSE(IoT)');
    const offeredCoursesArray = Array.from(coursesFound).sort();

    await saveStudentsToFirebase(parsedStudents, url);
    await saveSheetUrl(url, {
      departmentName: extractedDeptName,
      offeredCourses: offeredCoursesArray,
      totalStudents: parsedStudents.length
    });

    return parsedStudents;
  } catch (e) {
    console.error("Google Sheets sync error:", e);
    throw e;
  }
};
