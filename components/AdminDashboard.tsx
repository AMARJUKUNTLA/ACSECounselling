
import React, { useMemo, useState } from 'react';
import { Student } from '../types';
import StudentCard from './StudentCard';
import FileUpload from './FileUpload';
import * as CloudDB from '../services/databaseService';

interface AdminDashboardProps {
  students: Student[];
  onDataLoaded: (data: Student[]) => void;
  onClearDatabase: () => void;
  isLoading: boolean;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  students, 
  onDataLoaded, 
  onClearDatabase, 
  isLoading,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [sheetUrl, setSheetUrl] = useState(CloudDB.getSheetUrl());
  const [syncing, setSyncing] = useState(false);
  
  // Password Change State
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  
  // Selection States
  const [filterType, setFilterType] = useState<'all' | 'counsellor' | 'section'>('all');
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const stats = useMemo(() => {
    const counsellors: Record<string, number> = {};
    const sections: Record<string, number> = {};
    const branches: Record<string, number> = {};

    students.forEach(s => {
      const c = s.counsellor || 'Unassigned';
      const sec = `${s.year}-${s.branch}-${s.section}` || 'Unknown';
      const br = s.branch || 'Unknown';

      counsellors[c] = (counsellors[c] || 0) + 1;
      sections[sec] = (sections[sec] || 0) + 1;
      branches[br] = (branches[br] || 0) + 1;
    });

    return { counsellors, sections, branches, total: students.length };
  }, [students]);

  const filteredCounsellors = useMemo(() => {
    return Object.entries(stats.counsellors)
      .filter(([name]) => name.toLowerCase().includes(counsellorSearch.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  }, [stats.counsellors, counsellorSearch]);

  const filteredStudents = useMemo(() => {
    if (filterType === 'all' || !filterValue) return students;
    if (filterType === 'counsellor') return students.filter(s => (s.counsellor || 'Unassigned') === filterValue);
    if (filterType === 'section') return students.filter(s => `${s.year}-${s.branch}-${s.section}` === filterValue);
    return students;
  }, [students, filterType, filterValue]);

  const handleSync = async () => {
    if (!sheetUrl) return alert("Please enter a Google Sheets URL first.");
    setSyncing(true);
    try {
      CloudDB.saveSheetUrl(sheetUrl);
      const data = await CloudDB.fetchFromGoogleSheets(sheetUrl);
      onDataLoaded(data);
      alert(`Sync successful! ${data.length} records updated.`);
    } catch (e) {
      alert("Sync failed. Ensure your Google Sheet is set to 'Anyone with the link can view' as a Viewer.");
    } finally {
      setSyncing(false);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 4) return alert("Password must be at least 4 characters.");
    if (newPwd !== confirmPwd) return alert("Passwords do not match.");
    CloudDB.updateAdminPassword(newPwd);
    setNewPwd('');
    setConfirmPwd('');
    alert("Admin password updated successfully!");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-in fade-in duration-500">
      {/* Top Controls */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Analytics
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Options & Sync
          </button>
        </div>
        
        <button onClick={onLogout} className="flex items-center space-x-2 text-red-500 font-bold text-sm hover:bg-red-50 px-4 py-2 rounded-xl transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          <span>Logout</span>
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Left Column: Breakdowns */}
          <div className="lg:col-span-4 space-y-6 flex flex-col min-h-0">
            {/* Counsellor Selection */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-0 flex-1">
              <div className="p-6 border-b border-slate-50">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                  Counsellors
                </h3>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Search Counsellors..."
                    value={counsellorSearch}
                    onChange={(e) => setCounsellorSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-medium"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {filteredCounsellors.map(([name, count]) => (
                  <button 
                    key={name}
                    onClick={() => { setFilterType('counsellor'); setFilterValue(name); }}
                    className={`w-full text-left p-4 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50 transition-colors ${filterType === 'counsellor' && filterValue === name ? 'bg-indigo-50 border-r-4 border-r-indigo-500' : ''}`}
                  >
                    <span className="text-sm font-bold text-slate-700">{name}</span>
                    <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-full">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section Selection */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-0 flex-1">
              <div className="p-6 border-b border-slate-50">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                  Sections
                </h3>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {Object.entries(stats.sections).sort().map(([sec, count]) => (
                  <button 
                    key={sec}
                    onClick={() => { setFilterType('section'); setFilterValue(sec); }}
                    className={`w-full text-left p-4 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50 transition-colors ${filterType === 'section' && filterValue === sec ? 'bg-emerald-50 border-r-4 border-r-emerald-500' : ''}`}
                  >
                    <span className="text-sm font-bold text-slate-700">{sec}</span>
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Student List */}
          <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {filterType === 'all' ? 'All Student Records' : `${filterValue}`}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{filteredStudents.length} results</p>
              </div>
              {filterType !== 'all' && (
                <button onClick={() => { setFilterType('all'); setFilterValue(null); }} className="text-xs font-black text-indigo-600 uppercase bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">Clear Filters</button>
              )}
            </div>
            
            <div className="overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {filteredStudents.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => setSelectedStudent(s)}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-indigo-500 hover:bg-slate-50 cursor-pointer transition-all bg-white flex justify-between items-center group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 uppercase truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{s.regNo} • {s.branch}</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300">
                   <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                   <p className="font-bold">No students found for this selection.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Options & Sync Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-10">
          {/* Sync & Password */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center">
                <svg className="w-5 h-5 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                Sync with Google Sheets
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Spreadsheet URL</label>
                  <input 
                    type="text" 
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-medium text-sm"
                  />
                </div>
                <button 
                  onClick={handleSync} 
                  disabled={syncing}
                  className="w-full px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {syncing ? 'Syncing...' : 'Sync Cloud Data'}
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center">
                <svg className="w-5 h-5 mr-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                Admin Password
              </h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">New Password</label>
                    <input 
                      type="password" 
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-medium"
                      placeholder="Min 4 chars"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Confirm</label>
                    <input 
                      type="password" 
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-medium"
                    />
                  </div>
                </div>
                <button type="submit" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-lg w-full">Update Password</button>
              </form>
            </div>
          </div>

          {/* Upload & Cache */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 mb-6">Local Excel Upload</h3>
              <FileUpload onDataLoaded={onDataLoaded} isLoading={isLoading} />
            </div>

            <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100">
               <h4 className="text-red-900 font-black text-sm mb-2 uppercase tracking-widest">Danger Zone</h4>
               <p className="text-xs text-red-600/70 mb-6 leading-relaxed">Clearing the database will delete all local student records. You will need to re-sync or re-upload your Excel files.</p>
               <button onClick={onClearDatabase} className="w-full py-4 bg-white border border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all">Clear Database & Cache</button>
            </div>
          </div>
        </div>
      )}

      {/* Student Details Popup */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
             <button onClick={() => setSelectedStudent(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
             </button>
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Student Data View</h4>
             <StudentCard student={selectedStudent} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
