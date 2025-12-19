
import React, { useMemo, useState, useEffect } from 'react';
import { Student } from '../types';
import StudentCard from './StudentCard';

interface AdminDashboardProps {
  students: Student[];
  onDataLoaded: (data: Student[]) => void;
  onClearDatabase: () => void;
  isLoading: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  students, 
  onDataLoaded, 
  onClearDatabase, 
  isLoading 
}) => {
  const [selectedCounsellor, setSelectedCounsellor] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search states for breakdowns
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const stats = useMemo(() => {
    const branches = new Set(students.map(s => s.branch)).size;
    const years = new Set(students.map(s => s.year)).size;
    const counsellors = new Set(students.map(s => s.counsellor).filter(Boolean)).size;
    const uniqueSections = new Set(students.map(s => `${s.year}-${s.branch}-${s.section}`)).size;
    return { branches, years, sections: uniqueSections, counsellors };
  }, [students]);

  // Filtered breakdown data
  const counsellorAnalytics = useMemo(() => {
    const counsellorCounts: Record<string, number> = {};
    students.forEach(s => {
      const c = s.counsellor || 'Unassigned';
      counsellorCounts[c] = (counsellorCounts[c] || 0) + 1;
    });
    return Object.entries(counsellorCounts)
      .filter(([name]) => name.toLowerCase().includes(counsellorSearch.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  }, [students, counsellorSearch]);

  const sectionAnalytics = useMemo(() => {
    const sectionCounts: Record<string, number> = {};
    students.forEach(s => {
      const key = `${s.year} - ${s.branch} (Sec: ${s.section})`;
      sectionCounts[key] = (sectionCounts[key] || 0) + 1;
    });
    return Object.entries(sectionCounts)
      .filter(([name]) => name.toLowerCase().includes(sectionSearch.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [students, sectionSearch]);

  // Roster data logic
  const displayedStudents = useMemo(() => {
    if (selectedCounsellor) {
      return students.filter(s => (s.counsellor || 'Unassigned') === selectedCounsellor);
    }
    if (selectedSection) {
      return students.filter(s => `${s.year} - ${s.branch} (Sec: ${s.section})` === selectedSection);
    }
    return students; // Default to all
  }, [students, selectedCounsellor, selectedSection]);

  const openStudentDetails = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleCounsellorClick = (name: string) => {
    setSelectedSection(null);
    setSelectedCounsellor(name === selectedCounsellor ? null : name);
  };

  const handleSectionClick = (name: string) => {
    setSelectedCounsellor(null);
    setSelectedSection(name === selectedSection ? null : name);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 relative">
      {/* Student Details Modal */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-6 right-6 z-10">
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="max-h-[85vh] overflow-y-auto custom-scrollbar p-6 pt-12 sm:p-10">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Profile Details</h4>
              <StudentCard student={selectedStudent} />
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: students.length, color: 'text-slate-900' },
          { label: 'Departments', value: stats.branches, color: 'text-blue-600' },
          { label: 'Counsellors', value: stats.counsellors, color: 'text-indigo-600' },
          { label: 'Total Sections', value: stats.sections, color: 'text-orange-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className={`text-2xl md:text-3xl font-black ${stat.color} mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Breakdown Filters */}
        <div className="lg:col-span-4 space-y-8">
          {/* 1. Counsellor Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col max-h-[420px]">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Counsellors</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Click to Filter Roster</p>
            
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search staff..." 
                value={counsellorSearch}
                onChange={(e) => setCounsellorSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-300 text-sm font-bold"
              />
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {counsellorAnalytics.length > 0 ? counsellorAnalytics.map(([name, count]) => (
                <button 
                  key={name} 
                  onClick={() => handleCounsellorClick(name)} 
                  className={`w-full p-3 rounded-xl border text-left transition-all ${selectedCounsellor === name ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-indigo-300'}`}
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold truncate">{name}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${selectedCounsellor === name ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                  </div>
                </button>
              )) : (
                <p className="text-center text-slate-400 text-xs py-4">No staff matches</p>
              )}
            </div>
          </div>

          {/* 2. Section Roster Breakdown (Positioned below Counsellor Breakdown) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col max-h-[420px]">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Section Overview</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Class Distribution</p>
            
            <div className="relative mb-4">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path></svg>
              </div>
              <input 
                type="text" 
                placeholder="Filter sections..." 
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-300 text-sm font-bold"
              />
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {sectionAnalytics.length > 0 ? sectionAnalytics.map(([name, count]) => (
                <button 
                  key={name} 
                  onClick={() => handleSectionClick(name)} 
                  className={`w-full p-3 rounded-xl border text-left transition-all ${selectedSection === name ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-orange-300'}`}
                >
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-black truncate uppercase">{name}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${selectedSection === name ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                  </div>
                </button>
              )) : (
                <p className="text-center text-slate-400 text-xs py-4">No sections found</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Unified Student Roster (The main table/grid area) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[600px] max-h-[880px] overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-white sticky top-0 z-10 flex flex-wrap gap-4 justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {selectedCounsellor ? 'Staff Roster' : selectedSection ? 'Section Roster' : 'Global Student Directory'}
                </h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  { (selectedCounsellor || selectedSection) ? `Viewing: ${selectedCounsellor || selectedSection}` : 'Displaying All Active Records' }
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-900 uppercase">Records Found</span>
                  <span className="text-xs font-bold text-indigo-500">{displayedStudents.length} Students</span>
                </div>
                {(selectedCounsellor || selectedSection) && (
                  <button 
                    onClick={() => { setSelectedCounsellor(null); setSelectedSection(null); }} 
                    className="p-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-400 transition-all active:scale-95"
                    title="Clear Filter"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50/20">
              {displayedStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {displayedStudents.map(student => (
                    <div 
                      key={student.id} 
                      onClick={() => openStudentDetails(student)} 
                      className="p-5 rounded-[1.5rem] border border-slate-100 bg-white hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-2">
                          <h5 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors uppercase text-sm leading-tight line-clamp-1">{student.name}</h5>
                          <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-1">{student.regNo}</p>
                        </div>
                        <span className="text-[9px] font-black bg-slate-900 text-white px-2 py-1 rounded uppercase tracking-wider">{student.branch}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex flex-col items-center min-w-[50px]">
                           <span className="text-[8px] text-slate-400 font-black uppercase">Year</span>
                           <span className="text-xs font-black text-slate-700">{student.year}</span>
                        </div>
                        <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 flex flex-col items-center min-w-[50px]">
                           <span className="text-[8px] text-indigo-400 font-black uppercase">Sec</span>
                           <span className="text-xs font-black text-indigo-600">{student.section}</span>
                        </div>
                        {student.counsellor && !selectedCounsellor && (
                          <div className="flex-1 text-right">
                             <p className="text-[8px] text-slate-400 font-black uppercase">Counsellor</p>
                             <p className="text-[10px] font-bold text-slate-600 truncate">{student.counsellor}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 py-24 opacity-60">
                  <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 mb-8">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 tracking-tight">No Students to Display</h4>
                  <p className="text-slate-500 text-sm mt-3 max-w-xs mx-auto">The current filter or search returned no results. Try adjusting your sidebar selections or searching for something else.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
