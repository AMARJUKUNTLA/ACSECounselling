import { 
  collection, 
  doc, 
  onSnapshot, 
  deleteDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs,
  enableNetwork
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Student, AppUser, StudentRemark } from '../types';

// Firestore is used ONLY for student remarks as requested
const REMARKS_COLLECTION = 'remarks';

const LOCAL_STORAGE_KEYS = {
  STUDENTS: 'edubase_local_students_cache',
  USERS: 'edubase_local_users_cache',
  REMARKS: 'edubase_local_remarks_cache',
  CONFIG: 'edubase_local_config_cache',
  QUOTA_EXCEEDED: 'edubase_quota_exceeded_flag'
};

// Listeners for local reactive state
const studentsListeners = new Set<(students: Student[]) => void>();
const usersListeners = new Set<(users: AppUser[]) => void>();
const configListeners = new Set<(config: any) => void>();
const quotaListeners = new Set<(isExceeded: boolean) => void>();

// Quota State
let isQuotaExceededState = (() => {
  try {
    return sessionStorage.getItem(LOCAL_STORAGE_KEYS.QUOTA_EXCEEDED) === 'true';
  } catch (e) {
    return false;
  }
})();

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
    str.includes('free tier database') ||
    str.includes('backoff delay')
  );
};

export const notifyQuotaExceeded = () => {
  if (!isQuotaExceededState) {
    isQuotaExceededState = true;
    try {
      sessionStorage.setItem(LOCAL_STORAGE_KEYS.QUOTA_EXCEEDED, 'true');
    } catch (e) {}
    console.warn("⚠️ Firestore Quota Notice: Fallback to local cache active.");
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

const notifyStudentsSubscribers = (students: Student[]) => {
  studentsListeners.forEach(cb => {
    try {
      cb(students);
    } catch (err) {
      console.warn("Subscriber error:", err);
    }
  });
};

const notifyUsersSubscribers = (users: AppUser[]) => {
  usersListeners.forEach(cb => {
    try {
      cb(users);
    } catch (err) {
      console.warn("Subscriber error:", err);
    }
  });
};

const notifyConfigSubscribers = (config: any) => {
  configListeners.forEach(cb => {
    try {
      cb(config);
    } catch (err) {
      console.warn("Subscriber error:", err);
    }
  });
};

/**
 * Normalizes program / branch names.
 * Offered programs in Dept. of CSBS & IoT: B.Tech CSBS and B.Tech CSE(IoT).
 */
export const normalizeProgramBranch = (branchInput: string, regNo?: string): string => {
  if (!branchInput || !branchInput.trim() || branchInput.trim() === 'Not Assigned') return 'B.Tech CSBS';
  const trimmed = branchInput.trim();
  const lower = trimmed.toLowerCase();

  // If IoT is explicitly indicated without CSBS
  if (
    (lower.includes('iot') || lower.includes('internet of things')) && 
    !lower.includes('csbs') && 
    !lower.includes('business')
  ) {
    return 'B.Tech CSE(IoT)';
  }

  // If CSBS is explicitly indicated without IoT
  if (
    (lower.includes('csbs') || lower.includes('business')) && 
    !lower.includes('iot') && 
    !lower.includes('internet of things')
  ) {
    return 'B.Tech CSBS';
  }

  // If input contains combined/lateral descriptors
  if (
    lower.includes('combined') || 
    lower.includes('lateral') || 
    lower.includes('csbs & iot') || 
    lower.includes('csbs & cse') || 
    lower.includes('csbs/iot') || 
    lower.includes('iot/csbs')
  ) {
    if (regNo) {
      const cleanReg = regNo.toUpperCase();
      if (cleanReg.includes('49') || cleanReg.includes('IOT')) {
        return 'B.Tech CSE(IoT)';
      }
      if (cleanReg.includes('32') || cleanReg.includes('CB') || cleanReg.includes('CSBS')) {
        return 'B.Tech CSBS';
      }
    }
    return 'B.Tech CSBS';
  }

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

  return 'B.Tech CSBS';
};

/**
 * Returns the overarching Department name for a given program or branch.
 * Department name: 'Department of CSBS & IoT' as a single department for offered programs B.Tech CSBS and B.Tech CSE(IoT).
 */
export const getDepartmentForBranch = (branchOrDept: string): string => {
  if (!branchOrDept || !branchOrDept.trim() || branchOrDept === 'Not Assigned' || branchOrDept === 'General Faculty') {
    return 'Department of CSBS & IoT';
  }
  const program = normalizeProgramBranch(branchOrDept);
  const lower = program.toLowerCase();

  if (lower.includes('csbs') || lower.includes('iot') || lower.includes('cse')) {
    return 'Department of CSBS & IoT';
  }

  if (lower.startsWith('dept') || lower.startsWith('department')) {
    return branchOrDept;
  }

  return `Department of ${program}`;
};

export const normalizeAcademicYear = (yearInput?: string): string => {
  if (!yearInput) return '2';
  const trimmed = String(yearInput).trim().toUpperCase();
  if (trimmed === '2' || trimmed === '2ND' || trimmed === 'II' || trimmed === 'YEAR 2' || trimmed === '2ND YEAR' || trimmed === 'SECOND' || trimmed === 'E2') return '2';
  if (trimmed === '3' || trimmed === '3RD' || trimmed === 'III' || trimmed === 'YEAR 3' || trimmed === '3RD YEAR' || trimmed === 'THIRD' || trimmed === 'E3') return '3';
  if (trimmed === '4' || trimmed === '4TH' || trimmed === 'IV' || trimmed === 'YEAR 4' || trimmed === '4TH YEAR' || trimmed === 'FOURTH' || trimmed === 'E4') return '4';
  const match = trimmed.match(/[2-4]/);
  if (match) return match[0];
  return '2';
};

export const isValidStudentRecord = (s: { regNo?: string; name?: string; year?: string; branch?: string } | null | undefined): boolean => {
  if (!s) return false;
  const regNo = (s.regNo || '').trim().toLowerCase();
  const name = (s.name || '').trim().toLowerCase();
  const year = (s.year || '').trim().toLowerCase();
  const branch = (s.branch || '').trim().toLowerCase();

  // Filter out repeated header rows from concatenated sheets/files
  if ((regNo.includes('reg') && (regNo.includes('no') || regNo.includes('.'))) || regNo === 'sid' || regNo === 'roll no' || regNo === 'registration') return false;
  if (name.includes('student name') || name === 'name' || name === 'sname' || name === 'student' || name === 'stuname') return false;
  if (year === 'year' || year === 'academic year' || year === 'yr' || year === 'class') return false;
  if (branch === 'branch' || branch === 'department name' || branch === 'dept' || branch === 'dept name') return false;

  // Filter out total, summary, or completely blank rows
  if (regNo === 'total' || name === 'total' || name === 'grand total' || name === 'count') return false;
  if (!regNo && !name) return false;

  return true;
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
// 1. STUDENT MANAGEMENT (Local Persistent Store)
// ==========================================

export const subscribeToStudents = (
  onData: (students: Student[]) => void, 
  onError?: (err: Error) => void
) => {
  const cachedStudents = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []).filter(isValidStudentRecord);
  onData(cachedStudents);

  const listener = (updated: Student[]) => {
    onData(updated.filter(isValidStudentRecord));
  };
  studentsListeners.add(listener);

  return () => {
    studentsListeners.delete(listener);
  };
};

/**
 * Saves or updates student records locally while strictly preserving remarks.
 */
export const saveStudentsToFirebase = async (newStudents: Student[], sheetUrl?: string): Promise<void> => {
  const existingLocal = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const existingMap = new Map<string, Student>();
  existingLocal.forEach(s => {
    if (s.regNo) existingMap.set(s.regNo.trim().toUpperCase(), s);
    if (s.id) existingMap.set(s.id, s);
  });

  const nowIso = new Date().toISOString();

  const cleanStudents: Student[] = newStudents.filter(isValidStudentRecord).map(s => {
    const key = (s.regNo || '').trim().toUpperCase();
    const existing = existingMap.get(key) || existingMap.get(s.id);
    
    // CRITICAL: Preserve existing remarks
    const preservedRemarks = (existing && existing.remarks) ? existing.remarks : (s.remarks || undefined);

    return {
      ...s,
      year: normalizeAcademicYear(s.year),
      branch: normalizeProgramBranch(s.branch || '', s.regNo),
      ...(preservedRemarks ? { remarks: preservedRemarks } : {}),
      attendanceUpdatedAt: nowIso,
      updatedAt: nowIso
    };
  });

  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, cleanStudents);
  notifyStudentsSubscribers(cleanStudents);

  const cachedConfig = getLocalStorage<any>(LOCAL_STORAGE_KEYS.CONFIG, {});
  const newConfig = {
    ...cachedConfig,
    lastUpdated: nowIso,
    attendanceUpdatedAt: nowIso,
    totalStudents: cleanStudents.length,
    ...(sheetUrl !== undefined ? { sheetUrl } : {})
  };
  setLocalStorage(LOCAL_STORAGE_KEYS.CONFIG, newConfig);
  notifyConfigSubscribers(newConfig);

  // Automatically sync faculty accounts for all counsellors
  await syncCounsellorAccountsFromStudents(cleanStudents);
};

/**
 * Update ONLY attendance fields for a specific student, preserving remarks.
 */
export const updateStudentAttendanceInFirebase = async (
  studentId: string,
  attendanceData: {
    attendance?: string;
    subjectAttendance?: Record<string, string>;
    cgpa?: string;
    rGrade?: string;
    rGradeCount?: string | number;
    iGrade?: string;
    iGradeCredits?: string | number;
  }
): Promise<void> => {
  const nowIso = new Date().toISOString();
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const updatedList = localList.map(s => {
    if (s.id === studentId || s.regNo === studentId) {
      return {
        ...s,
        ...attendanceData,
        attendanceUpdatedAt: nowIso,
        updatedAt: nowIso
      };
    }
    return s;
  });
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedList);
  notifyStudentsSubscribers(updatedList);
};

export const addStudentToFirebase = async (student: Omit<Student, 'id'>): Promise<string> => {
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const tempId = `st-local-${Date.now()}`;
  const newStudentRecord: Student = { 
    ...student, 
    id: tempId, 
    branch: normalizeProgramBranch(student.branch || ''),
    year: normalizeAcademicYear(student.year),
    updatedAt: new Date().toISOString()
  };
  const updatedList = [newStudentRecord, ...localList];
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedList);
  notifyStudentsSubscribers(updatedList);

  if (student.counsellor) {
    await syncCounsellorAccountsFromStudents(updatedList);
  }

  return tempId;
};

export const updateStudentInFirebase = async (id: string, updatedFields: Partial<Student>): Promise<void> => {
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const updatedList = localList.map(s => {
    if (s.id === id || s.regNo === id) {
      return { 
        ...s, 
        ...updatedFields, 
        branch: updatedFields.branch ? normalizeProgramBranch(updatedFields.branch, s.regNo) : s.branch,
        year: updatedFields.year ? normalizeAcademicYear(updatedFields.year) : s.year,
        updatedAt: new Date().toISOString() 
      };
    }
    return s;
  });
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedList);
  notifyStudentsSubscribers(updatedList);
};

export const deleteStudentFromFirebase = async (id: string): Promise<void> => {
  const localList = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const updatedList = localList.filter(s => s.id !== id && s.regNo !== id);
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedList);
  notifyStudentsSubscribers(updatedList);
};

// ==========================================
// 2. USER AUTH & MANAGEMENT (Local Persistent Store)
// ==========================================

const DEFAULT_ACCOUNTS: AppUser[] = [
  {
    id: 'usr-admin-system',
    email: 'admin@edubase.edu',
    name: 'System Administrator',
    role: 'admin',
    department: 'Administration',
    phone: '9876543210',
    password: 'admin',
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr-faculty-default',
    email: 'faculty@edubase.edu',
    name: 'Dr. Rahul Sharma',
    role: 'faculty',
    department: 'Department of CSBS & IoT',
    phone: '9876543211',
    password: 'faculty123',
    createdAt: new Date().toISOString()
  }
];

export const seedDefaultUsersIfEmpty = async (): Promise<void> => {
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  if (cachedUsers.length === 0) {
    setLocalStorage(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
    notifyUsersSubscribers(DEFAULT_ACCOUNTS);
  }
};

export const subscribeToUsers = (onData: (users: AppUser[]) => void) => {
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, []);
  if (cachedUsers.length === 0) {
    setLocalStorage(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
    onData(DEFAULT_ACCOUNTS);
  } else {
    onData(cachedUsers);
  }

  const listener = (users: AppUser[]) => {
    onData(users);
  };
  usersListeners.add(listener);

  return () => {
    usersListeners.delete(listener);
  };
};

export const syncCounsellorAccountsFromStudents = async (studentList?: Student[]): Promise<number> => {
  const students = studentList || getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  if (!students || students.length === 0) return 0;

  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
  const existingNames = new Set(cachedUsers.map(u => (u.name || '').trim().toLowerCase()));
  const existingEmails = new Set(cachedUsers.map(u => (u.email || '').trim().toLowerCase()));

  const uniqueCounsellors = Array.from(new Set(
    students
      .map(s => (s.counsellor || '').trim())
      .filter(c => c && c.length > 2 && c.toLowerCase() !== 'not assigned' && c.toLowerCase() !== 'general faculty')
  ));

  let newlyCreated = 0;
  const updatedUsers = [...cachedUsers];

  uniqueCounsellors.forEach(cName => {
    const cleanName = cName.trim();
    if (!existingNames.has(cleanName.toLowerCase())) {
      const emailPrefix = cleanName
        .toLowerCase()
        .replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.)\s*/i, '')
        .replace(/[^a-z0-9]/g, '.');
      let genEmail = `${emailPrefix || 'counsellor'}@edubase.edu`;
      
      let counter = 1;
      while (existingEmails.has(genEmail)) {
        genEmail = `${emailPrefix}${counter}@edubase.edu`;
        counter++;
      }

      existingNames.add(cleanName.toLowerCase());
      existingEmails.add(genEmail);

      const newUser: AppUser = {
        id: `usr-counsellor-${Date.now()}-${newlyCreated}`,
        name: cleanName,
        email: genEmail,
        role: 'faculty',
        department: 'Department of CSBS & IoT',
        phone: '',
        password: 'faculty123',
        createdAt: new Date().toISOString()
      };
      updatedUsers.push(newUser);
      newlyCreated++;
    }
  });

  if (newlyCreated > 0) {
    setLocalStorage(LOCAL_STORAGE_KEYS.USERS, updatedUsers);
    notifyUsersSubscribers(updatedUsers);
  }

  return newlyCreated;
};

export const loginUser = async (emailOrNameOrId: string, passwordInput: string): Promise<AppUser> => {
  const formattedInput = emailOrNameOrId.trim().toLowerCase();
  const searchEmail = formattedInput.includes('@') ? formattedInput : `${formattedInput}@edubase.edu`;

  const allUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);

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

  // Fallbacks
  if (formattedInput === 'admin' && passwordInput === 'admin') {
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
      department: 'Department of CSBS & IoT'
    };
  }

  throw new Error("Invalid credentials. Account not found in Authorized Users directory.");
};

export const addUserToFirebase = async (userData: {
  name: string;
  email: string;
  role: 'admin' | 'faculty';
  department?: string;
  phone?: string;
  password?: string;
}): Promise<string> => {
  const email = userData.email.trim().toLowerCase();
  const password = userData.password || (userData.role === 'admin' ? 'admin' : 'faculty123');
  const customDocId = `usr-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const newUser: AppUser = {
    id: customDocId,
    name: userData.name.trim(),
    email: email,
    role: userData.role,
    department: userData.department || 'Department of CSBS & IoT',
    phone: userData.phone || '',
    password: password,
    createdAt: new Date().toISOString()
  };

  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
  const updated = [...cachedUsers.filter(u => u.id !== customDocId && u.email !== email), newUser];
  setLocalStorage(LOCAL_STORAGE_KEYS.USERS, updated);
  notifyUsersSubscribers(updated);

  return customDocId;
};

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
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
  const updated = cachedUsers.map(u => u.id === userId ? { ...u, ...updatedFields } : u);
  setLocalStorage(LOCAL_STORAGE_KEYS.USERS, updated);
  notifyUsersSubscribers(updated);
};

export const deleteUserFromFirebase = async (userId: string): Promise<void> => {
  const cachedUsers = getLocalStorage<AppUser[]>(LOCAL_STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
  const updated = cachedUsers.filter(u => u.id !== userId);
  setLocalStorage(LOCAL_STORAGE_KEYS.USERS, updated);
  notifyUsersSubscribers(updated);
};

export const logoutUserFromFirebase = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.warn("Logout error:", e);
  }
};

// ==========================================
// 3. STUDENT REMARKS & COUNSELING NOTES (Firebase Cloud Firestore)
// ==========================================

/**
 * Real-time subscription to remarks for a specific student from Firebase Firestore.
 */
export const subscribeToRemarksForStudent = (studentId: string, onData: (remarks: StudentRemark[]) => void) => {
  const cachedAll = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  onData(cachedAll.filter(r => r.studentId === studentId));

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
      console.warn("Firebase remarks student listener notice:", err);
      if (isQuotaError(err)) notifyQuotaExceeded();
    });
  } catch (err) {
    console.warn("Firebase remarks student subscription error:", err);
    if (isQuotaError(err)) notifyQuotaExceeded();
    return () => {};
  }
};

/**
 * Real-time subscription to ALL student remarks stored in Firebase Firestore.
 * Automatically synchronizes remarks with student records.
 */
export const subscribeToAllRemarks = (onData: (remarks: StudentRemark[]) => void) => {
  const cachedAll = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  if (cachedAll.length > 0) onData(cachedAll);

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

      // Synchronize latest remark to local student records
      const latestRemarksByStudent = new Map<string, string>();
      list.forEach(r => {
        if (r.studentId && !latestRemarksByStudent.has(r.studentId)) {
          latestRemarksByStudent.set(r.studentId, r.remark);
        }
        if (r.studentRegNo && !latestRemarksByStudent.has(r.studentRegNo)) {
          latestRemarksByStudent.set(r.studentRegNo, r.remark);
        }
      });

      const localStudents = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
      let hasStudentChange = false;
      const updatedStudents = localStudents.map(s => {
        const matchingRemark = latestRemarksByStudent.get(s.id) || (s.regNo ? latestRemarksByStudent.get(s.regNo) : undefined);
        if (matchingRemark && s.remarks !== matchingRemark) {
          hasStudentChange = true;
          return { ...s, remarks: matchingRemark };
        }
        return s;
      });

      if (hasStudentChange) {
        setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedStudents);
        notifyStudentsSubscribers(updatedStudents);
      }
    }, (err) => {
      console.warn("Firebase all-remarks listener notice:", err);
      if (isQuotaError(err)) notifyQuotaExceeded();
    });
  } catch (err) {
    console.warn("Firebase all-remarks subscription error:", err);
    if (isQuotaError(err)) notifyQuotaExceeded();
    return () => {};
  }
};

/**
 * Add a new student remark / counseling note directly to Firebase Firestore.
 */
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
  const tempId = `rem-${Date.now()}`;
  const nowIso = new Date().toISOString();
  
  const newRemark: StudentRemark = {
    ...remarkData,
    id: tempId,
    createdAt: nowIso
  };
  
  const updatedRemarks = [newRemark, ...cached];
  setLocalStorage(LOCAL_STORAGE_KEYS.REMARKS, updatedRemarks);

  // Update remarks on local student record immediately
  const localStudents = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []);
  const updatedStudents = localStudents.map(s => {
    if (s.id === remarkData.studentId || (s.regNo && s.regNo === remarkData.studentRegNo)) {
      return { ...s, remarks: remarkData.remark.trim() };
    }
    return s;
  });
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedStudents);
  notifyStudentsSubscribers(updatedStudents);

  try {
    const remarksColRef = collection(db, REMARKS_COLLECTION);
    const docRef = await addDoc(remarksColRef, {
      studentId: remarkData.studentId,
      studentRegNo: remarkData.studentRegNo,
      studentName: remarkData.studentName || '',
      facultyId: remarkData.facultyId,
      facultyName: remarkData.facultyName,
      category: remarkData.category,
      remark: remarkData.remark.trim(),
      createdAt: nowIso
    });
    return docRef.id;
  } catch (e) {
    console.warn("Error adding remark to Firebase:", e);
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
    }
    return tempId;
  }
};

/**
 * Delete a student remark from Firebase Firestore.
 */
export const deleteRemarkFromFirebase = async (remarkId: string): Promise<void> => {
  const cached = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  const updated = cached.filter(r => r.id !== remarkId);
  setLocalStorage(LOCAL_STORAGE_KEYS.REMARKS, updated);

  try {
    const docRef = doc(db, REMARKS_COLLECTION, remarkId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn("Error deleting remark from Firebase:", e);
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
    }
  }
};

/**
 * Update an existing student remark in Firebase Firestore.
 */
export const updateRemarkInFirebase = async (
  remarkId: string, 
  updatedText: string, 
  category?: 'counseling' | 'discipline' | 'attendance' | 'academic' | 'general'
): Promise<void> => {
  const cached = getLocalStorage<StudentRemark[]>(LOCAL_STORAGE_KEYS.REMARKS, []);
  const updated = cached.map(r => {
    if (r.id === remarkId) {
      return {
        ...r,
        remark: updatedText.trim(),
        ...(category ? { category } : {})
      };
    }
    return r;
  });
  setLocalStorage(LOCAL_STORAGE_KEYS.REMARKS, updated);

  try {
    const docRef = doc(db, REMARKS_COLLECTION, remarkId);
    const payload: any = {
      remark: updatedText.trim(),
      updatedAt: new Date().toISOString()
    };
    if (category) payload.category = category;
    await updateDoc(docRef, payload);
  } catch (e) {
    console.warn("Error updating remark in Firebase:", e);
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
    }
  }
};

// ==========================================
// 4. CONFIG & GOOGLE SHEET SYNC (Local Persistent Store)
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
    departmentName: 'Department of CSBS & IoT',
    offeredCourses: ['B.Tech CSBS', 'B.Tech CSE(IoT)']
  });
  onData(cachedConfig);

  const listener = (cfg: any) => {
    onData(cfg);
  };
  configListeners.add(listener);

  return () => {
    configListeners.delete(listener);
  };
};

export const saveSheetUrl = async (
  url: string, 
  extraConfig?: { departmentName?: string; offeredCourses?: string[]; totalStudents?: number }
): Promise<void> => {
  const cachedConfig = getLocalStorage<any>(LOCAL_STORAGE_KEYS.CONFIG, {});
  const rawOffered: string[] = extraConfig?.offeredCourses || cachedConfig.offeredCourses || ['B.Tech CSBS', 'B.Tech CSE(IoT)'];
  const cleanOffered = Array.from(new Set(rawOffered.map((c: string) => normalizeProgramBranch(c))))
    .filter(c => c === 'B.Tech CSBS' || c === 'B.Tech CSE(IoT)');

  const newConfig = { 
    ...cachedConfig, 
    sheetUrl: url, 
    lastUpdated: new Date().toISOString(),
    departmentName: extraConfig?.departmentName || cachedConfig.departmentName || 'Department of CSBS & IoT',
    offeredCourses: cleanOffered.length > 0 ? cleanOffered : ['B.Tech CSBS', 'B.Tech CSE(IoT)'],
    totalStudents: extraConfig?.totalStudents ?? cachedConfig.totalStudents ?? 0
  };
  setLocalStorage(LOCAL_STORAGE_KEYS.CONFIG, newConfig);
  notifyConfigSubscribers(newConfig);
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
    
    // Department of CSBS & IoT
    const extractedDeptName = 'Department of CSBS & IoT';

    const coursesFound = new Set<string>();

    const parsedStudents: Student[] = lines
      .slice(1)
      .filter(line => line.trim())
      .map((line, index) => {
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
        const regNoVal = getVal(['sid', 'reg.no', 'reg no', 'registration', 'regno', 'rno', 'rollno', 'roll no', 'htno', 'hallticket']);
        const rawYear = getVal(['year', 'academic year', 'yr', 'class']);
        const normBranch = normalizeProgramBranch(rawBranch, regNoVal);
        const normYear = normalizeAcademicYear(rawYear);
        coursesFound.add(normBranch);

        return {
          regNo: regNoVal,
          name: getVal(['sname', 'name', 'student name', 'stuname', 'full name']),
          phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile', 'mobile']),
          phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile', 'parent mobile']),
          counsellor: getVal(['cname', 'counsellor name', 'counante', 'counsellor', 'mentor', 'faculty advisor', 'guide']),
          year: normYear,
          section: getVal(['section', 'sec']) || 'A',
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
      })
      .filter(isValidStudentRecord);

    const offeredCoursesArray = ['B.Tech CSBS', 'B.Tech CSE(IoT)'];

    await saveStudentsToFirebase(parsedStudents, url);
    await saveSheetUrl(url, {
      departmentName: extractedDeptName,
      offeredCourses: offeredCoursesArray,
      totalStudents: parsedStudents.length
    });

    return parsedStudents;
  } catch (e) {
    console.warn("Google Sheets sync error:", e);
    throw e;
  }
};
