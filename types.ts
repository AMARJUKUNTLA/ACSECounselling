export interface Student {
  regNo: string;
  name: string;
  phone1: string;
  phone2: string;
  counsellor: string; // Mentor or Counsellor
  year: string;
  section: string;
  branch: string;
  id: string; // Internal ID
  cgpa?: string;
  attendance?: string;
  rGrade?: string;
  rGradeCount?: string | number;
  iGrade?: string;
  iGradeCredits?: string | number;
  subjectAttendance?: Record<string, string>;
}

export type UserRole = 'admin' | 'faculty';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  createdAt?: string;
  phone?: string;
  password?: string;
}

export interface StudentRemark {
  id: string;
  studentId: string;
  studentRegNo: string;
  studentName?: string;
  facultyId: string;
  facultyName: string;
  category: 'counseling' | 'discipline' | 'attendance' | 'academic' | 'general';
  remark: string;
  createdAt: string;
}

export interface SearchFilters {
  query: string;
  branch?: string;
  year?: string;
  section?: string;
}
