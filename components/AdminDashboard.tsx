import React, { useMemo, useState, useEffect } from 'react';
import { Student, AppUser } from '../types';
import StudentCard from './StudentCard';
import FileUpload from './FileUpload';
import { 
  subscribeToUsers, 
  addUserToFirebase, 
  deleteUserFromFirebase,
  syncCounsellorAccountsFromStudents 
} from '../services/databaseService';

interface AdminDashboardProps {
  students: Student[];
  currentUser: AppUser;
  isLoading: boolean;
  sheetUrl: string;
  lastUpdated?: string;
  onExcelUpload: (students: Student[]) => Promise<void>;
  onGoogleSheetSync: (url: string) => Promise<void>;
  onAddStudent: (student: Omit<Student, 'id'>) => Promise<void>;
  onUpdateStudent: (id: string, updated: Partial<Student>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  students, 
  currentUser,
  isLoading,
  sheetUrl,
  lastUpdated,
  onExcelUpload,
  onGoogleSheetSync,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent
}) => {
  // Tab view inside Admin
  const [adminTab, setAdminTab] = useState<'students' | 'faculty'>('students');

  // Selection & UI States
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [studentListSearch, setStudentListSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Users / Faculty List
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Modals & Panels
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form Inputs
  const [googleUrlInput, setGoogleUrlInput] = useState(sheetUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);

  // Add/Edit Student Form state
  const [formData, setFormData] = useState({
    regNo: '',
    name: '',
    phone1: '',
    phone2: '',
    counsellor: '',
    year: '1',
    section: 'A',
    branch: 'CSE'
  });

  // Add User / Faculty Form state
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: 'faculty' as 'faculty' | 'admin',
    department: 'Computer Science',
    phone: '',
    password: 'faculty123'
  });

  useEffect(() => {
    if (sheetUrl) setGoogleUrlInput(sheetUrl);
  }, [sheetUrl]);

  // Subscribe to Users
  useEffect(() => {
    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const counsellors: Record<string, number> = {};
    const branches: Record<string, number> = {};
    const sectionsSet = new Set<string>();
    const branchYearBreakdown: Record<string, Record<string, number>> = {};

    students.forEach(s => {
      const c = s.counsellor || 'Unassigned';
      const br = (s.branch || 'Unknown').toUpperCase();
      const yr = s.year || 'N/A';
      const secKey = `${s.year}-${s.branch}-${s.section}`;

      counsellors[c] = (counsellors[c] || 0) + 1;
      branches[br] = (branches[br] || 0) + 1;
      if (s.section) sectionsSet.add(secKey);

      if (!branchYearBreakdown[br]) branchYearBreakdown[br] = {};
      branchYearBreakdown[br][yr] = (branchYearBreakdown[br][yr] || 0) + 1;
    });

    return { 
      counsellors, 
      branches, 
      total: students.length, 
      totalSections: sectionsSet.size,
      branchYearBreakdown 
    };
  }, [students]);

  useEffect(() => {
    const names = Object.keys(stats.counsellors);
    if (!filterValue && names.length > 0) {
      setFilterValue(names[0]);
    }
  }, [stats.counsellors, filterValue]);

  const filteredCounsellors = useMemo(() => {
    return Object.entries(stats.counsellors)
      .filter(([name]) => name.toLowerCase().includes(counsellorSearch.toLowerCase()))
      .sort((a, b) => (b[1] as number) - (a[1] as number));
  }, [stats.counsellors, counsellorSearch]);

  const displayedStudents = useMemo(() => {
    if (!filterValue) return [];
    let list = students.filter(s => (s.counsellor || 'Unassigned') === filterValue);
    
    if (studentListSearch.trim()) {
      const q = studentListSearch.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.regNo.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, filterValue, studentListSearch]);

  const handleExcelLoaded = async (uploadedData: Student[]) => {
    setIsProcessing(true);
    try {
      await onExcelUpload(uploadedData);
      setShowUploadModal(false);
      alert(`Success! Uploaded ${uploadedData.length} students to Firebase Cloud.`);
    } catch (err) {
      alert("Failed to upload data to Firebase. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUrlInput.trim()) return;
    setIsProcessing(true);
    try {
      await onGoogleSheetSync(googleUrlInput.trim());
      setShowSheetModal(false);
      alert("Successfully synced Google Sheet data to Firebase Cloud!");
    } catch (err: any) {
      alert(`Sync failed: ${err.message || 'Check URL or sharing permissions'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.regNo.trim()) {
      alert("Student Name and SID/Reg No are required.");
      return;
    }
    setIsProcessing(true);
    try {
      if (editingStudent) {
        await onUpdateStudent(editingStudent.id, formData);
        alert("Student updated in Firebase Cloud!");
        setEditingStudent(null);
      } else {
        await onAddStudent(formData);
        alert("Student added to Firebase Cloud!");
        setShowAddModal(false);
      }
      setFormData({ regNo: '', name: '', phone1: '', phone2: '', counsellor: '', year: '1', section: 'A', branch: 'CSE' });
    } catch (e) {
      alert("Failed to save student record.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.email.trim()) {
      alert("Name and Email are required.");
      return;
    }
    setIsProcessing(true);
    try {
      await addUserToFirebase(userFormData);
      alert(`Successfully added ${userFormData.role === 'admin' ? 'Admin' : 'Faculty'} member: ${userFormData.name}`);
      setShowAddUserModal(false);
      setUserFormData({ name: '', email: '', role: 'faculty', department: 'Computer Science', phone: '', password: 'faculty123' });
    } catch (e: any) {
      alert(`Failed to add user: ${e.message || 'Error occurred'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to remove ${userName} from authorized portal access?`)) {
      try {
        await deleteUserFromFirebase(userId);
      } catch (err) {
        alert("Failed to delete user account.");
      }
    }
  };

  const handleSyncCounsellors = async () => {
    setIsProcessing(true);
    try {
      const created = await syncCounsellorAccountsFromStudents(students);
      alert(`Counsellor Account Sync Complete!\n${created > 0 ? `Created ${created} new faculty accounts for counsellors in the student data.` : 'All counsellors in the student dataset already have faculty accounts.'}`);
    } catch (err: any) {
      alert("Error syncing counsellor accounts: " + (err.message || "Failed to sync"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCounsellorAccountByName = async (cName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUser = users.find(u => 
      u.name.trim().toLowerCase() === cName.trim().toLowerCase() ||
      u.email.toLowerCase().includes(cName.toLowerCase().replace(/[^a-z0-9]/g, '_'))
    );

    if (targetUser) {
      await handleDeleteUser(targetUser.id, targetUser.name);
    } else {
      if (window.confirm(`No active faculty user account document was found for counsellor "${cName}". Would you like to generate faculty accounts now?`)) {
        await handleSyncCounsellors();
      }
    }
  };

  const handleDelete = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to delete ${studentName} from Firebase Cloud?`)) {
      setIsProcessing(true);
      try {
        await onDeleteStudent(studentId);
        if (selectedStudent?.id === studentId) setSelectedStudent(null);
      } catch (err) {
        alert("Failed to delete student.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setFormData({
      regNo: s.regNo,
      name: s.name,
      phone1: s.phone1,
      phone2: s.phone2,
      counsellor: s.counsellor,
      year: s.year,
      section: s.section,
      branch: s.branch
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 pb-10">
      
      {/* Top Bar with Navigation Tabs for Admin */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">System Admin Console</h2>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Logged in as Admin: <span className="text-slate-700">{currentUser.name}</span> ({currentUser.email})
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setAdminTab('students')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${adminTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Student Directory ({students.length})
          </button>
          <button 
            onClick={() => setAdminTab('faculty')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${adminTab === 'faculty' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Faculty & Personnel ({users.length})
          </button>
        </div>
      </div>

      {/* STUDENT DIRECTORY MANAGEMENT TAB */}
      {adminTab === 'students' && (
        <>
          {/* Action Toolbar */}
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 pl-2">
              <span>{lastUpdated ? `Last synchronized: ${new Date(lastUpdated).toLocaleString()}` : 'Live real-time Firebase sync active'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all shadow-md flex items-center space-x-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <span>Upload Excel</span>
              </button>

              <button 
                onClick={() => setShowSheetModal(true)}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all shadow-md flex items-center space-x-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                <span>Sync Google Sheet</span>
              </button>

              <button 
                onClick={() => {
                  setEditingStudent(null);
                  setFormData({ regNo: '', name: '', phone1: '', phone2: '', counsellor: '', year: '1', section: 'A', branch: 'CSE' });
                  setShowAddModal(true);
                }}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all shadow-md flex items-center space-x-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
             <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl">
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Total Students</p>
                <p className="text-3xl font-black mt-1">{stats.total}</p>
             </div>
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departments</p>
                <p className="text-3xl font-black text-slate-800 mt-1">{Object.keys(stats.branches).length}</p>
             </div>
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Mentors</p>
                <p className="text-3xl font-black text-indigo-600 mt-1">{Object.keys(stats.counsellors).length}</p>
             </div>
             <div className="bg-emerald-600 p-6 rounded-[2rem] text-white shadow-xl">
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Total Sections</p>
                <p className="text-3xl font-black mt-1">{stats.totalSections}</p>
             </div>
          </div>

          {/* Academic Breakdown */}
          <div className="mb-8 overflow-x-auto pb-4 custom-scrollbar">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              Academic Distribution (Department / Years)
            </h3>
            <div className="flex space-x-4">
              {Object.entries(stats.branchYearBreakdown).sort().map(([branch, years]) => {
                const availableYears = Object.keys(years).sort((a, b) => Number(a) - Number(b));
                return (
                  <div key={branch} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm min-w-[280px] flex-shrink-0">
                    <div className="flex justify-between items-center mb-4">
                      <p className="font-black text-slate-800 uppercase text-[11px] truncate max-w-[150px]">{branch}</p>
                      <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">Total: {stats.branches[branch]}</span>
                    </div>
                    <div className={`grid gap-2 ${availableYears.length > 3 ? 'grid-cols-4' : availableYears.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {availableYears.map(y => (
                        <div key={y} className="bg-slate-50 p-2.5 rounded-2xl text-center border border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Year {y}</p>
                          <p className="text-sm font-black text-slate-800">{years[y] || 0}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Left Column: Mentors List */}
            <div className="lg:col-span-4 flex flex-col min-h-0 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                    Counsellors / Mentors
                  </h3>
                  <button 
                    onClick={handleSyncCounsellors}
                    disabled={isProcessing}
                    className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg transition-all"
                    title="Auto-create faculty accounts for all counsellors in student dataset"
                  >
                    Sync Accounts
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Search counsellors..."
                    value={counsellorSearch}
                    onChange={(e) => setCounsellorSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-sm font-medium transition-all"
                  />
                  <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {filteredCounsellors.map(([name, count]) => {
                  const hasAccount = users.some(u => u.name.trim().toLowerCase() === name.trim().toLowerCase());
                  return (
                    <div 
                      key={name}
                      onClick={() => { setFilterValue(name); setStudentListSearch(''); }}
                      className={`w-full text-left p-4 border-b border-slate-50 flex items-center justify-between transition-all cursor-pointer group ${filterValue === name ? 'bg-indigo-50 border-r-4 border-r-indigo-500' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-sm font-bold truncate ${filterValue === name ? 'text-indigo-700' : 'text-slate-800'}`}>{name}</span>
                          {hasAccount && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Faculty login account active"></span>
                          )}
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{count} Assigned Student{count > 1 ? 's' : ''}</span>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${filterValue === name ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                        <button 
                          onClick={(e) => handleDeleteCounsellorAccountByName(name, e)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title={`Delete faculty account for ${name}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Dynamic Student List */}
            <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 border-b border-slate-50 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-slate-900 truncate">
                    {filterValue || 'Select a Mentor'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Direct Student List (Firebase Synced)</p>
                </div>
                
                {filterValue && (
                  <div className="relative flex-1 max-w-xs">
                    <input 
                      type="text"
                      placeholder="Search in this list..."
                      value={studentListSearch}
                      onChange={(e) => setStudentListSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-bold transition-all"
                    />
                    <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>
                )}
              </div>
              
              <div className="overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 items-start content-start">
                {displayedStudents.map(s => (
                  <div 
                    key={s.id} 
                    className="p-5 rounded-3xl border border-slate-100 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-50/50 cursor-pointer transition-all bg-white flex flex-col group relative"
                  >
                    <div onClick={() => setSelectedStudent(s)} className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight flex-1">{s.name}</p>
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase ml-2 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">{s.branch}</span>
                      </div>
                      <div className="flex items-center text-[11px] text-slate-400 font-bold space-x-2 mb-3">
                        <span>{s.regNo}</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span>Year {s.year}</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span>Sec {s.section}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-50">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(s); }}
                        className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black hover:bg-red-600 hover:text-white transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {displayedStudents.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300">
                     <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                     <p className="font-bold uppercase tracking-widest text-xs">No records available for this selection</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* FACULTY & AUTHORIZED USERS MANAGEMENT TAB */}
      {adminTab === 'faculty' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Faculty & Counsellor Personnel Directory</h3>
              <p className="text-xs text-slate-400 font-medium">Manage authorized faculty and counsellor accounts who can sign in and record student observations.</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleSyncCounsellors}
                disabled={isProcessing}
                className="px-4 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-2xl font-black text-xs transition-all flex items-center space-x-2 active:scale-95"
                title="Auto-create faculty user accounts for all counsellor names found in student data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                <span>Sync Accounts from Counsellors</span>
              </button>

              <button 
                onClick={() => setShowAddUserModal(true)}
                className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center space-x-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                <span>Add Faculty / Admin</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((u) => {
              const dept = (u.department || '').toLowerCase();
              const isCounsellorAccount = u.id.includes('counsellor') || dept.includes('counsellor') || dept.includes('mentor');
              return (
                <div key={u.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-300 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${u.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                          {u.role}
                        </span>
                        {isCounsellorAccount && (
                          <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-indigo-100 text-indigo-700">
                            Data Counsellor
                          </span>
                        )}
                      </div>

                      {u.id !== currentUser.id && (
                        <button 
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all flex items-center space-x-1"
                          title="Delete faculty / counsellor account"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                    <h4 className="text-base font-black text-slate-800">{u.name}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">{u.email}</p>
                    <p className="text-xs text-indigo-600 font-bold mt-2 bg-indigo-50 px-3 py-1.5 rounded-xl inline-block">{u.department || 'Faculty Member'}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Login: <code className="text-slate-700 font-mono">{u.name}</code></span>
                    <span>Pass: <code className="text-indigo-600 font-mono">faculty123</code></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Faculty / Admin Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddUserModal(false)} />
          <form onSubmit={handleAddUser} className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setShowAddUserModal(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-2xl font-black text-slate-900 mb-1">Add Authorized Faculty / Admin</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Grants portal login access</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Full Name *</label>
                <input 
                  type="text"
                  value={userFormData.name}
                  onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                  placeholder="e.g. Dr. Priya Sundaram"
                  required
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email / Username *</label>
                <input 
                  type="email"
                  value={userFormData.email}
                  onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                  placeholder="e.g. priya@edubase.edu"
                  required
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Role *</label>
                  <select 
                    value={userFormData.role}
                    onChange={(e: any) => setUserFormData({...userFormData, role: e.target.value})}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="faculty">Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Department</label>
                  <input 
                    type="text"
                    value={userFormData.department}
                    onChange={e => setUserFormData({...userFormData, department: e.target.value})}
                    placeholder="e.g. CSE"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Set Account Password *</label>
                <input 
                  type="text"
                  value={userFormData.password}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder="e.g. faculty123"
                  required
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center space-x-2"
            >
              {isProcessing && <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>}
              <span>Register Authorized Account</span>
            </button>
          </form>
        </div>
      )}

      {/* Upload Excel Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Import Excel / CSV to Firebase</h3>
            <p className="text-slate-500 mb-6 text-sm">Upload Excel spreadsheet. All parsed student rows will be saved directly into Firebase Cloud Firestore.</p>
            <FileUpload onDataLoaded={handleExcelLoaded} isLoading={isProcessing} />
          </div>
        </div>
      )}

      {/* Sync Google Sheet Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSheetModal(false)} />
          <form onSubmit={handleGoogleSheetSubmit} className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setShowSheetModal(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Sync Google Sheets to Firebase</h3>
            <p className="text-slate-500 mb-6 text-sm">Paste a public Google Sheet URL. Data will be fetched and stored directly into Firebase Cloud Firestore for real-time synchronization.</p>
            <div className="space-y-4">
              <input 
                type="text" 
                value={googleUrlInput}
                onChange={(e) => setGoogleUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold"
              />
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center space-x-2"
              >
                {isProcessing && <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>{isProcessing ? 'Syncing to Firebase...' : 'Import to Firebase Cloud'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add or Edit Student Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingStudent(null); }} />
          <form onSubmit={handleSaveStudent} className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => { setShowAddModal(false); setEditingStudent(null); }} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-2xl font-black text-slate-900 mb-1">{editingStudent ? 'Edit Student Record' : 'Add New Student'}</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Persists directly into Firebase Cloud</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">SID / Reg No *</label>
                <input 
                  type="text" 
                  value={formData.regNo} 
                  onChange={e => setFormData({...formData, regNo: e.target.value})}
                  placeholder="e.g. 21BCE1001"
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Student Name *</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Student Mobile</label>
                <input 
                  type="text" 
                  value={formData.phone1} 
                  onChange={e => setFormData({...formData, phone1: e.target.value})}
                  placeholder="e.g. 9876543210"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Parent Mobile</label>
                <input 
                  type="text" 
                  value={formData.phone2} 
                  onChange={e => setFormData({...formData, phone2: e.target.value})}
                  placeholder="e.g. 9876543211"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mentor / Counsellor</label>
                <input 
                  type="text" 
                  value={formData.counsellor} 
                  onChange={e => setFormData({...formData, counsellor: e.target.value})}
                  placeholder="e.g. Dr. A. Kumar"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Branch / Dept</label>
                <input 
                  type="text" 
                  value={formData.branch} 
                  onChange={e => setFormData({...formData, branch: e.target.value})}
                  placeholder="e.g. CSE"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Year</label>
                <input 
                  type="text" 
                  value={formData.year} 
                  onChange={e => setFormData({...formData, year: e.target.value})}
                  placeholder="e.g. 1"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Section</label>
                <input 
                  type="text" 
                  value={formData.section} 
                  onChange={e => setFormData({...formData, section: e.target.value})}
                  placeholder="e.g. A"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isProcessing}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center space-x-2"
            >
              {isProcessing && <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>}
              <span>{editingStudent ? 'Save Changes' : 'Save to Firebase Cloud'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Student Profile Popup */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
             <button onClick={() => setSelectedStudent(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
             </button>
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Detailed Student Profile</h4>
             <StudentCard student={selectedStudent} currentUser={currentUser} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
