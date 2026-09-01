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
  where,
  disableNetwork,
  enableNetwork
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
  CONFIG: 'edubase_local_config_cache',
  QUOTA_EXCEEDED: 'edubase_quota_exceeded_flag'
};

// Quota State & Listeners
let isQuotaExceededState = (() => {
  try {
    return sessionStorage.getItem(LOCAL_STORAGE_KEYS.QUOTA_EXCEEDED) === 'true';
  } catch (e) {
    return false;
  }
})();

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
    console.warn("⚠️ Firestore Quota Exceeded. Disabling Firestore network to prevent retries and backoff delays.");
    try {
      disableNetwork(db).catch(() => {});
    } catch (e) {}
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

  // If input contains combined/lateral descriptors (e.g. "B.Tech CSBS & CSE (IoT) (Combined/Lateral)", "Combined/Lateral", "CSBS & IoT")
  if (
    lower.includes('combined') || 
    lower.includes('lateral') || 
    lower.includes('csbs & iot') || 
    lower.includes('csbs & cse') || 
    lower.includes('csbs/iot') || 
    lower.includes('iot/csbs')
  ) {
    // Check if regNo or string specifies branch
    if (regNo) {
      const cleanReg = regNo.toUpperCase();
      if (cleanReg.includes('49') || cleanReg.includes('IOT')) {
        return 'B.Tech CSE(IoT)';
      }
      if (cleanReg.includes('32') || cleanReg.includes('CB') || cleanReg.includes('CSBS')) {
        return 'B.Tech CSBS';
      }
    }
    // Default to B.Tech CSBS
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
// 1. STUDENT MANAGEMENT
// ==========================================

export const subscribeToStudents = (
  onData: (students: Student[]) => void, 
  onError?: (err: Error) => void
) => {
  // Immediately serve cached students if present (filtered of bad header rows)
  const cachedStudents = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []).filter(isValidStudentRecord);
  if (cachedStudents.length > 0) {
    onData(cachedStudents);
  }

  const studentsColRef = collection(db, STUDENTS_COLLECTION);
  return onSnapshot(studentsColRef, (snapshot) => {
    const studentsList: Student[] = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data();
        const regNo = data.regNo || '';
        return {
          id: docSnap.id,
          regNo,
          name: data.name || '',
          phone1: data.phone1 || '',
          phone2: data.phone2 || '',
          counsellor: data.counsellor || '',
          year: normalizeAcademicYear(data.year),
          section: data.section || '',
          branch: normalizeProgramBranch(data.branch || '', regNo),
          cgpa: data.cgpa || '',
          attendance: data.attendance || '',
          rGrade: data.rGrade || '',
          rGradeCount: data.rGradeCount ?? '',
          iGrade: data.iGrade || '',
          iGradeCredits: data.iGradeCredits ?? '',
          subjectAttendance: data.subjectAttendance || {},
          remarks: data.remarks || '',
          attendanceUpdatedAt: data.attendanceUpdatedAt || data.updatedAt || '',
          updatedAt: data.updatedAt || ''
        };
      })
      .filter(isValidStudentRecord);

    studentsList.sort((a, b) => a.name.localeCompare(b.name));
    setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, studentsList);
    onData(studentsList);
  }, (error) => {
    console.warn("Firestore real-time subscription notice:", error);
    if (isQuotaError(error)) {
      notifyQuotaExceeded();
    }
    const fallback = getLocalStorage<Student[]>(LOCAL_STORAGE_KEYS.STUDENTS, []).filter(isValidStudentRecord);
    onData(fallback);
    if (onError) onError(error);
  });
};

/**
 * Partial Attendance Update - Strictly Preserves Remarks and Non-Attendance Fields
 * Performs a partial update ({ merge: true }) in Firebase Firestore and updates attendanceUpdatedAt.
 * CRITICAL: 'remarks' is NEVER deleted, overwritten, cleared, replaced, or set to null/empty.
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
    
    // CRITICAL: Preserve existing remarks from local cache if present
    const preservedRemarks = (existing && existing.remarks) ? existing.remarks : (s.remarks || undefined);
    const existingAttendanceUpdated = existing?.attendanceUpdatedAt;

    return {
      ...s,
      year: normalizeAcademicYear(s.year),
      branch: normalizeProgramBranch(s.branch || '', s.regNo),
      ...(preservedRemarks ? { remarks: preservedRemarks } : {}),
      attendanceUpdatedAt: nowIso
    };
  });

  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, cleanStudents);

  if (isQuotaExceededState) {
    console.warn("Quota exceeded: Saved student attendance to local cache only.");
    return;
  }

  try {
    // We do NOT delete existing docs. We perform partial merge updates so existing remarks and fields are strictly preserved.
    for (let i = 0; i < cleanStudents.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = cleanStudents.slice(i, i + 400);

      chunk.forEach((student, idx) => {
        const docId = student.regNo 
          ? `st-${student.regNo.replace(/[^a-zA-Z0-9_-]/g, '_')}` 
          : `st-${i + idx}-${Date.now()}`;
        const docRef = doc(db, STUDENTS_COLLECTION, docId);

        // Attendance & Academic payload - ONLY attendance and student identity fields
        // STRICT RULE: Do NOT include remarks: "", remarks: null, remarks: undefined
        const updatePayload: Record<string, any> = {
          regNo: student.regNo || '',
          name: student.name || '',
          phone1: student.phone1 || '',
          phone2: student.phone2 || '',
          counsellor: student.counsellor || '',
          year: normalizeAcademicYear(student.year),
          section: student.section || '',
          branch: normalizeProgramBranch(student.branch || '', student.regNo),
          cgpa: student.cgpa || '',
          attendance: student.attendance || '',
          rGrade: student.rGrade || '',
          rGradeCount: student.rGradeCount ?? '',
          iGrade: student.iGrade || '',
          iGradeCredits: student.iGradeCredits ?? '',
          subjectAttendance: sanitizeSubjectAttendance(student.subjectAttendance),
          attendanceUpdatedAt: nowIso,
          updatedAt: nowIso
        };

        // If remarks is explicitly present on student object and non-empty, preserve it; otherwise DO NOT touch remarks
        if (student.remarks && student.remarks.trim()) {
          updatePayload.remarks = student.remarks.trim();
        }

        // Use { merge: true } to guarantee that existing remarks in Firebase Firestore are NEVER deleted or overwritten!
        batch.set(docRef, updatePayload, { merge: true });
      });

      await batch.commit();
    }

    const configRef = doc(db, CONFIG_DOC_PATH);
    const configUpdate: any = {
      lastUpdated: nowIso,
      attendanceUpdatedAt: nowIso,
      totalStudents: cleanStudents.length
    };
    if (sheetUrl !== undefined) {
      configUpdate.sheetUrl = sheetUrl;
    }
    await setDoc(configRef, configUpdate, { merge: true });

    // Automatically sync faculty user accounts for any new counsellors found
    await syncCounsellorAccountsFromStudents(cleanStudents);
  } catch (error) {
    if (isQuotaError(error)) {
      notifyQuotaExceeded();
      console.warn("Firestore Quota exceeded while updating attendance. Maintained in local cache.");
      return;
    }
    console.error("Error updating student attendance in Firebase:", error);
    throw error;
  }
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
        attendanceUpdatedAt: nowIso
      };
    }
    return s;
  });
  setLocalStorage(LOCAL_STORAGE_KEYS.STUDENTS, updatedList);

  if (isQuotaExceededState) return;

  try {
    const docId = studentId.startsWith('st-') ? studentId : `st-${studentId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const studentDocRef = doc(db, STUDENTS_COLLECTION, docId);

    const updatePayload: Record<string, any> = {
      attendanceUpdatedAt: nowIso,
      updatedAt: nowIso
    };

    if (attendanceData.attendance !== undefined) updatePayload.attendance = attendanceData.attendance;
    if (attendanceData.cgpa !== undefined) updatePayload.cgpa = attendanceData.cgpa;
    if (attendanceData.rGrade !== undefined) updatePayload.rGrade = attendanceData.rGrade;
    if (attendanceData.rGradeCount !== undefined) updatePayload.rGradeCount = attendanceData.rGradeCount;
    if (attendanceData.iGrade !== undefined) updatePayload.iGrade = attendanceData.iGrade;
    if (attendanceData.iGradeCredits !== undefined) updatePayload.iGradeCredits = attendanceData.iGradeCredits;
    if (attendanceData.subjectAttendance) {
      updatePayload.subjectAttendance = sanitizeSubjectAttendance(attendanceData.subjectAttendance);
    }

    // Partial update - remarks and other fields are strictly preserved
    await setDoc(studentDocRef, updatePayload, { merge: true });
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      return;
    }
    throw e;
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
        department: 'Department of CSBS & IoT',
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
      const counsellorDept = depts.length > 0 ? (depts.length === 1 ? depts[0] : depts.join(', ')) : 'Department of CSBS & IoT';

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
    if (isQuotaError(err)) {
      notifyQuotaExceeded();
    } else {
      console.warn("Notice syncing counsellor accounts:", err);
    }
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
      department: 'Department of CSBS & IoT'
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
    department: userData.department || 'Department of CSBS & IoT',
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
    departmentName: 'Department of CSBS & IoT',
    offeredCourses: ['B.Tech CSBS', 'B.Tech CSE(IoT)']
  });
  onData(cachedConfig);

  if (isQuotaExceededState) return () => {};

  try {
    const configRef = doc(db, CONFIG_DOC_PATH);
    return onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawOffered: string[] = data.offeredCourses || ['B.Tech CSBS', 'B.Tech CSE(IoT)'];
        const cleanOffered = Array.from(new Set(rawOffered.map(c => normalizeProgramBranch(c))))
          .filter(c => c === 'B.Tech CSBS' || c === 'B.Tech CSE(IoT)');
        const cfg = {
          sheetUrl: data.sheetUrl || '',
          lastUpdated: data.lastUpdated || '',
          totalStudents: data.totalStudents || 0,
          departmentName: data.departmentName || 'Department of CSBS & IoT',
          offeredCourses: cleanOffered.length > 0 ? cleanOffered : ['B.Tech CSBS', 'B.Tech CSE(IoT)']
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
    
    // Single overarching department name
    let extractedDeptName = 'Department of CSBS & IoT';

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

    // Offered courses must strictly be B.Tech CSBS & B.Tech CSE(IoT)
    const offeredCoursesArray = ['B.Tech CSBS', 'B.Tech CSE(IoT)'];

    await saveStudentsToFirebase(parsedStudents, url);
    await saveSheetUrl(url, {
      departmentName: extractedDeptName,
      offeredCourses: offeredCoursesArray,
      totalStudents: parsedStudents.length
    });

    return parsedStudents;
  } catch (e) {
    if (isQuotaError(e)) {
      notifyQuotaExceeded();
      console.warn("Google Sheets sync notice: Firestore quota exceeded. Data saved to local cache.");
    } else {
      console.warn("Google Sheets sync notice:", e);
    }
    throw e;
  }
};
