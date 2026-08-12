import React, { useState, useMemo } from 'react';
import { Student, AppUser } from '../types';
import StudentCard from './StudentCard';
import { normalizeProgramBranch, getDepartmentForBranch } from '../services/databaseService';

interface FacultyDashboardProps {
  students: Student[];
  currentUser: AppUser;
  isLoading: boolean;
}

const FacultyDashboard: React.FC<FacultyDashboardProps> = ({
  students,
  currentUser,
  isLoading
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Extract unique programs/branches
  const branches = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.branch) {
        set.add(normalizeProgramBranch(s.branch).toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [students]);

  const years = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.year) set.add(s.year);
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        s.name.toLowerCase().includes(q) || 
        s.regNo.toLowerCase().includes(q) ||
        (s.counsellor && s.counsellor.toLowerCase().includes(q)) ||
        (s.phone1 && s.phone1.includes(q)) ||
        (s.phone2 && s.phone2.includes(q)) ||
        (s.branch && s.branch.toLowerCase().includes(q)) ||
        (s.section && s.section.toLowerCase().includes(q)) ||
        (s.year && s.year.toLowerCase().includes(q));

      const normBranch = normalizeProgramBranch(s.branch || '').toUpperCase();
      const matchesBranch = selectedBranch === 'ALL' || normBranch === selectedBranch;
      const matchesYear = selectedYear === 'ALL' || s.year === selectedYear;

      return matchesQuery && matchesBranch && matchesYear;
    });
  }, [students, searchQuery, selectedBranch, selectedYear]);

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 pb-10">
      
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse"></span>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Faculty Counseling & Behavior Portal</h2>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Logged in as Faculty: <span className="text-indigo-600 font-black">{currentUser.name}</span> ({currentUser.department || 'Academic Faculty'})
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-indigo-50 px-4 py-2.5 rounded-2xl border border-indigo-100">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-black text-indigo-900">Counseling Access Active</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, Reg No, phone, mentor, program..."
              className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 transition-all"
            />
            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <div className="md:col-span-3">
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Branches / Departments ({branches.length})</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="md:col-span-3">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Academic Years</option>
              {years.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50 text-xs font-bold text-slate-400">
          <span>Showing {filteredStudents.length} of {students.length} students</span>
          {(searchQuery || selectedBranch !== 'ALL' || selectedYear !== 'ALL') && (
            <button 
              onClick={() => { setSearchQuery(''); setSelectedBranch('ALL'); setSelectedYear('ALL'); }}
              className="text-indigo-600 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Student Cards List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Student Directory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStudents.map((s) => (
            <StudentCard key={s.id} student={s} currentUser={currentUser} />
          ))}

          {filteredStudents.length === 0 && (
            <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-slate-100 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-black text-slate-700 uppercase tracking-wider">No Students Match Search Criteria</h3>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FacultyDashboard;
