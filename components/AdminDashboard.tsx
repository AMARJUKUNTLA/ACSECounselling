import React, { useMemo, useState, useEffect } from 'react';
import { Student } from '../types';
import StudentCard from './StudentCard';
import FileUpload from './FileUpload';

interface AdminDashboardProps {
  students: Student[];
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
  isLoading,
  sheetUrl,
  lastUpdated,
  onExcelUpload,
  onGoogleSheetSync,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent
}) => {
  // Selection & UI States
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [studentListSearch, setStudentListSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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

  useEffect(() => {
    if (sheetUrl) setGoogleUrlInput(sheetUrl);
  }, [sheetUrl]);

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
      
      {/* Action Header & Cloud Sync Toolbar */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Firebase Cloud Admin Panel</h2>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-1">
            {lastUpdated ? `Last synchronized: ${new Date(lastUpdated).toLocaleString()}` : 'Live real-time Firebase sync active'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowUploadModal(true)}
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center space-x-2 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            <span>Upload Excel / CSV</span>
          </button>

          <button 
            onClick={() => setShowSheetModal(true)}
            className="px-5 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center space-x-2 active:scale-95"
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
            className="px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-lg flex items-center space-x-2 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
         <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Firebase Cloud Total</p>
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

      {/* Dynamic Academic Breakdown */}
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
          <div className="p-6 border-b border-slate-50 shrink-0">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              Mentors List
            </h3>
            <div className="relative">
              <input 
                type="text"
                placeholder="Search mentors..."
                value={counsellorSearch}
                onChange={(e) => setCounsellorSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-sm font-medium transition-all"
              />
              <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {filteredCounsellors.map(([name, count]) => (
              <button 
                key={name}
                onClick={() => { setFilterValue(name); setStudentListSearch(''); }}
                className={`w-full text-left p-5 border-b border-slate-50 flex justify-between items-center transition-all ${filterValue === name ? 'bg-indigo-50 border-r-4 border-r-indigo-500' : 'hover:bg-slate-50'}`}
              >
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-bold truncate ${filterValue === name ? 'text-indigo-700' : 'text-slate-700'}`}>{name}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">Assigned Students</span>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${filterValue === name ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            ))}
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

                {/* Edit & Delete Action Buttons */}
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
             <StudentCard student={selectedStudent} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
