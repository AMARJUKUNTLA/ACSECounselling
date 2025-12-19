
import React, { useMemo, useState, useEffect } from 'react';
import { Student } from '../types';
import StudentCard from './StudentCard';

interface AdminDashboardProps {
  students: Student[];
  isLoading: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  students, 
  isLoading
}) => {
  // Selection States
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const stats = useMemo(() => {
    const counsellors: Record<string, number> = {};
    const branches: Record<string, number> = {};
    const sectionsSet = new Set<string>();
    
    // Branch -> Year -> Count
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

  // Default selection: select the first mentor if none selected
  useEffect(() => {
    const mentorNames = Object.keys(stats.counsellors);
    if (!filterValue && mentorNames.length > 0) {
      setFilterValue(mentorNames[0]);
    }
  }, [stats.counsellors, filterValue]);

  const filteredCounsellors = useMemo(() => {
    return Object.entries(stats.counsellors)
      .filter(([name]) => name.toLowerCase().includes(counsellorSearch.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  }, [stats.counsellors, counsellorSearch]);

  const displayedStudents = useMemo(() => {
    if (!filterValue) return [];
    let list = students.filter(s => (s.counsellor || 'Unassigned') === filterValue);
    
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.regNo.toLowerCase().includes(q) ||
        (s.phone1 && s.phone1.includes(q))
      );
    }
    return list;
  }, [students, filterValue, listSearchQuery]);

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 pb-10">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
         <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl">
            <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Master Database</p>
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

      {/* Branch/Year Breakdown Grid */}
      <div className="mb-8 overflow-x-auto pb-4 custom-scrollbar">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
          Academic Distribution (Dynamic Years)
        </h3>
        <div className="flex space-x-4">
          {Object.entries(stats.branchYearBreakdown).sort().map(([branch, years]) => {
            // Dynamically get available years for this branch to satisfy 3-year (B.Sc) and 2-year (M.Sc) logic automatically
            const yearList = Object.keys(years).sort((a, b) => parseInt(a) - parseInt(b));
            
            return (
              <div key={branch} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm min-w-[280px] flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <p className="font-black text-slate-800 uppercase text-[11px] truncate max-w-[160px]">{branch}</p>
                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">Total: {stats.branches[branch]}</span>
                </div>
                <div className={`grid gap-2 grid-cols-${Math.min(yearList.length, 4)}`}>
                  {yearList.map(y => (
                    <div key={y} className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Year {y}</p>
                      <p className="text-sm font-black text-slate-700">{years[y] || 0}</p>
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
              Mentors
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
                onClick={() => { setFilterValue(name); setListSearchQuery(''); }}
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

        {/* Right Column: Dynamic Student List with SEARCH */}
        <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <div>
              <h3 className="text-xl font-black text-slate-900 truncate max-w-[300px]">
                {filterValue || 'Select Mentor'}
              </h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Student Directory</p>
            </div>
            
            {filterValue && (
              <div className="relative flex-1 max-w-sm">
                <input 
                  type="text"
                  placeholder="Search in this mentor's list..."
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-500 outline-none text-xs font-bold transition-all"
                />
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            )}
          </div>
          
          <div className="overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 items-start content-start">
            {displayedStudents.map(s => (
              <div 
                key={s.id} 
                onClick={() => setSelectedStudent(s)}
                className="p-5 rounded-3xl border border-slate-100 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-50/50 cursor-pointer transition-all bg-white flex flex-col group"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight flex-1">{s.name}</p>
                  <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase ml-2 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">{s.branch}</span>
                </div>
                <div className="flex items-center text-[11px] text-slate-400 font-bold space-x-2">
                  <span>{s.regNo}</span>
                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                  <span>Year {s.year}</span>
                </div>
              </div>
            ))}
            {displayedStudents.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300">
                 <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 <p className="font-bold uppercase tracking-widest text-xs text-center">No students found{listSearchQuery ? ` matching "${listSearchQuery}"` : ''}</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
