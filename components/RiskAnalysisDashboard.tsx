import React, { useState, useMemo } from 'react';
import { Student, AppUser } from '../types';
import StudentCard from './StudentCard';

interface RiskAnalysisDashboardProps {
  students: Student[];
  currentUser: AppUser;
  onSelectStudent?: (student: Student) => void;
}

export interface RiskAnalysis {
  student: Student;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  attendanceVal: number;
  cgpaVal: number;
  hasRGrade: boolean;
  hasIGrade: boolean;
  rGradeCount: number;
  iGradeCount: number;
}

const RiskAnalysisDashboard: React.FC<RiskAnalysisDashboardProps> = ({
  students,
  currentUser,
  onSelectStudent
}) => {
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LOW_ATTENDANCE' | 'R_GRADE' | 'I_GRADE'>('HIGH');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);

  // Compute Risk Metrics for all students
  const analyzedStudents: RiskAnalysis[] = useMemo(() => {
    return students.map(s => {
      const attNum = parseFloat((s.attendance || '0').toString().replace('%', ''));
      const cgpaNum = parseFloat((s.cgpa || '0').toString());
      const rGradeStr = (s.rGrade || '').trim().toLowerCase();
      const iGradeStr = (s.iGrade || '').trim().toLowerCase();

      const hasR = rGradeStr !== '' && rGradeStr !== 'none' && rGradeStr !== '0';
      const hasI = iGradeStr !== '' && iGradeStr !== 'none' && iGradeStr !== '0';

      const rCount = parseInt((s.rGradeCount || '0').toString()) || (hasR ? (s.rGrade || '').split(',').filter(Boolean).length : 0);
      const iCount = parseInt((s.iGradeCredits || '0').toString()) || (hasI ? (s.iGrade || '').split(',').filter(Boolean).length : 0);

      const reasons: string[] = [];

      // Risk Evaluation Rules
      if (attNum < 75) {
        reasons.push(`Attendance below mandatory 75% limit (${attNum}%)`);
      } else if (attNum >= 75 && attNum <= 80) {
        reasons.push(`Borderline attendance (${attNum}%)`);
      }

      if (hasR) {
        reasons.push(`R-Grade Courses (${rCount} subjects disqualified due to low attendance)`);
      }

      if (hasI) {
        reasons.push(`I-Grade Courses (${iCount} credits/subjects incomplete due to marks shortage)`);
      }

      if (cgpaNum > 0 && cgpaNum < 6.0) {
        reasons.push(`Low CGPA (${cgpaNum})`);
      } else if (cgpaNum >= 6.0 && cgpaNum < 6.8) {
        reasons.push(`Average CGPA (${cgpaNum})`);
      }

      // Risk Categorization
      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (attNum < 75 || hasR || (cgpaNum > 0 && cgpaNum < 6.0) || iCount >= 3) {
        riskLevel = 'HIGH';
      } else if ((attNum >= 75 && attNum <= 80) || hasI || (cgpaNum >= 6.0 && cgpaNum < 6.8)) {
        riskLevel = 'MEDIUM';
      }

      return {
        student: s,
        riskLevel,
        reasons,
        attendanceVal: attNum,
        cgpaVal: cgpaNum,
        hasRGrade: hasR,
        hasIGrade: hasI,
        rGradeCount: rCount,
        iGradeCount: iCount
      };
    });
  }, [students]);

  // Overall Cohort Summary Statistics
  const stats = useMemo(() => {
    const total = analyzedStudents.length;
    const highRisk = analyzedStudents.filter(a => a.riskLevel === 'HIGH');
    const mediumRisk = analyzedStudents.filter(a => a.riskLevel === 'MEDIUM');
    const lowRisk = analyzedStudents.filter(a => a.riskLevel === 'LOW');

    const lowAtt = analyzedStudents.filter(a => a.attendanceVal < 75);
    const rGradeHolders = analyzedStudents.filter(a => a.hasRGrade);
    const iGradeHolders = analyzedStudents.filter(a => a.hasIGrade);

    const validCgpas = analyzedStudents.map(a => a.cgpaVal).filter(c => c > 0);
    const avgCgpa = validCgpas.length > 0 ? (validCgpas.reduce((a, b) => a + b, 0) / validCgpas.length).toFixed(2) : 'N/A';

    const validAtt = analyzedStudents.map(a => a.attendanceVal).filter(a => a > 0);
    const avgAtt = validAtt.length > 0 ? (validAtt.reduce((a, b) => a + b, 0) / validAtt.length).toFixed(1) : 'N/A';

    return {
      total,
      highRiskCount: highRisk.length,
      mediumRiskCount: mediumRisk.length,
      lowRiskCount: lowRisk.length,
      lowAttCount: lowAtt.length,
      rGradeCount: rGradeHolders.length,
      iGradeCount: iGradeHolders.length,
      avgCgpa,
      avgAtt
    };
  }, [analyzedStudents]);

  // Filtered List
  const filteredList = useMemo(() => {
    return analyzedStudents.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const s = item.student;
      const matchesSearch = !q || 
        s.name.toLowerCase().includes(q) ||
        s.regNo.toLowerCase().includes(q) ||
        (s.counsellor && s.counsellor.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (riskFilter === 'HIGH') return item.riskLevel === 'HIGH';
      if (riskFilter === 'MEDIUM') return item.riskLevel === 'MEDIUM';
      if (riskFilter === 'LOW') return item.riskLevel === 'LOW';
      if (riskFilter === 'LOW_ATTENDANCE') return item.attendanceVal < 75;
      if (riskFilter === 'R_GRADE') return item.hasRGrade;
      if (riskFilter === 'I_GRADE') return item.hasIGrade;

      return true;
    });
  }, [analyzedStudents, riskFilter, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Risk Analysis Top Banner */}
      <div className="bg-gradient-to-r from-red-900 via-slate-900 to-indigo-950 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full text-xs font-black text-red-300">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
              <span>ACADEMIC & ATTENDANCE RISK ANALYSIS ENGINE</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Critical Risk & Counseling Advisory
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl font-medium leading-relaxed">
              Automated detection of students requiring mandatory counsellor monitoring based on Attendance (&lt;75%), R-Grade (attendance shortages), I-Grade (supply exam backlogs), and CGPA standing.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center shrink-0 min-w-[160px]">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">Critical Action Items</span>
            <span className="text-3xl font-black text-red-400">{stats.highRiskCount} Students</span>
            <span className="text-[10px] font-bold text-red-200 block mt-1">Need Urgent Mentoring</span>
          </div>
        </div>
      </div>

      {/* Analytics KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Class Size</span>
          <span className="text-2xl font-black text-slate-800">{stats.total}</span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">3rd Year CSBS</span>
        </div>

        <div className="bg-red-50/80 p-5 rounded-3xl border border-red-100 shadow-sm">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block">High Risk</span>
          <span className="text-2xl font-black text-red-700">{stats.highRiskCount}</span>
          <span className="text-[10px] font-bold text-red-600 block mt-0.5">{((stats.highRiskCount / (stats.total || 1)) * 100).toFixed(0)}% of Class</span>
        </div>

        <div className="bg-amber-50/80 p-5 rounded-3xl border border-amber-100 shadow-sm">
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">Watchlist Risk</span>
          <span className="text-2xl font-black text-amber-800">{stats.mediumRiskCount}</span>
          <span className="text-[10px] font-bold text-amber-700 block mt-0.5">Borderline Att / CGPA</span>
        </div>

        <div className="bg-red-50/50 p-5 rounded-3xl border border-red-100 shadow-sm">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block">Att. Shortage (&lt;75%)</span>
          <span className="text-2xl font-black text-red-600">{stats.lowAttCount}</span>
          <span className="text-[10px] font-bold text-red-500 block mt-0.5">Must maintain &ge;75%</span>
        </div>

        <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100 shadow-sm">
          <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">R-Grade Holders</span>
          <span className="text-2xl font-black text-amber-900">{stats.rGradeCount}</span>
          <span className="text-[10px] font-bold text-amber-800 block mt-0.5">Disqualified subjects</span>
        </div>

        <div className="bg-purple-50/80 p-5 rounded-3xl border border-purple-100 shadow-sm">
          <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">I-Grade Holders</span>
          <span className="text-2xl font-black text-purple-900">{stats.iGradeCount}</span>
          <span className="text-[10px] font-bold text-purple-700 block mt-0.5">Supply exam needed</span>
        </div>
      </div>

      {/* Actionable Counseling Guidelines & Strategy Box */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Action Plan for Counsellors & Mentors</h3>
            <p className="text-xs font-bold text-slate-400">Standard Operating Protocol to Improve Academic & Personal Growth</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Strategy 1 */}
          <div className="bg-red-50/50 p-5 rounded-2xl border border-red-100 space-y-2">
            <span className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider inline-block">1. Attendance Recovery</span>
            <h4 className="text-sm font-black text-slate-800">Maintain &ge; 75% Attendance Threshold</h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Counsellor must schedule weekly attendance check-ins. Immediately contact parent (<span className="font-mono text-slate-800 font-bold">FPHNO</span>) when attendance drops below 75% to prevent subject disqualification.
            </p>
          </div>

          {/* Strategy 2 */}
          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 space-y-2">
            <span className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider inline-block">2. R-Grade Remediation</span>
            <h4 className="text-sm font-black text-slate-800">Attendance Shortage Clearance</h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              For students with R-Grades (e.g. <span className="font-bold text-slate-800">MEESALA VENU - 22 R-Grades</span>), assist in planning summer fast-track re-registrations and remedial lab hours.
            </p>
          </div>

          {/* Strategy 3 */}
          <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 space-y-2">
            <span className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider inline-block">3. I-Grade Supply Exams</span>
            <h4 className="text-sm font-black text-slate-800">Internal Marks Recovery</h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Pair students having I-Grades (e.g. <span className="font-bold text-slate-800">LOLABATTU SRIBABU - 16 Credits</span>) with high CGPA peer-tutors (&gt;8.0) and schedule subject revision tests.
            </p>
          </div>

          {/* Strategy 4 */}
          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 space-y-2">
            <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider inline-block">4. Personal Mentoring</span>
            <h4 className="text-sm font-black text-slate-800">Holistic Personal Growth</h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Conduct bi-weekly 1-on-1 counseling covering stress management, personal obstacles, time management, and logging progress in the student's counseling remarks timeline.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Risk Filtering & Search Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Risk Level Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'HIGH', label: `🚨 High Risk (${stats.highRiskCount})`, color: 'bg-red-600 text-white' },
              { id: 'MEDIUM', label: `⚠️ Watchlist (${stats.mediumRiskCount})`, color: 'bg-amber-600 text-white' },
              { id: 'LOW_ATTENDANCE', label: `📉 Attendance < 75% (${stats.lowAttCount})`, color: 'bg-red-100 text-red-800' },
              { id: 'R_GRADE', label: `🚫 R-Grade (${stats.rGradeCount})`, color: 'bg-amber-100 text-amber-900' },
              { id: 'I_GRADE', label: `📝 I-Grade (${stats.iGradeCount})`, color: 'bg-purple-100 text-purple-900' },
              { id: 'LOW', label: `✅ Good Standing (${stats.lowRiskCount})`, color: 'bg-emerald-600 text-white' },
              { id: 'ALL', label: `All Students (${stats.total})`, color: 'bg-slate-800 text-white' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setRiskFilter(f.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${riskFilter === f.id ? `${f.color} shadow-md scale-105` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search student or mentor..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-400 pt-2 border-t border-slate-50">
          Showing <span className="text-slate-800 font-extrabold">{filteredList.length}</span> students in this filter view
        </div>
      </div>

      {/* Student List View with Risk Badges & Counseling Action Trigger */}
      <div className="space-y-4">
        {filteredList.map(({ student, riskLevel, reasons, attendanceVal, cgpaVal, hasRGrade, hasIGrade }) => (
          <div 
            key={student.id}
            className={`p-6 rounded-[2rem] border transition-all hover:shadow-md bg-white ${riskLevel === 'HIGH' ? 'border-red-200 hover:border-red-400' : riskLevel === 'MEDIUM' ? 'border-amber-200 hover:border-amber-400' : 'border-slate-100 hover:border-slate-300'}`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Student Basic Details */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">{student.name}</h3>
                  <span className="font-mono text-xs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">{student.regNo}</span>
                  
                  {/* Risk Badge */}
                  {riskLevel === 'HIGH' && (
                    <span className="px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                      🚨 CRITICAL RISK
                    </span>
                  )}
                  {riskLevel === 'MEDIUM' && (
                    <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                      ⚠️ WATCHLIST
                    </span>
                  )}
                  {riskLevel === 'LOW' && (
                    <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                      ✅ GOOD STANDING
                    </span>
                  )}
                </div>

                <p className="text-xs font-bold text-slate-500">
                  Counsellor: <span className="text-indigo-600 font-black">{student.counsellor || 'Unassigned'}</span> | Student Mob: <span className="font-mono text-slate-800">{student.phone1 || 'N/A'}</span> | Parent Mob: <span className="font-mono text-slate-800">{student.phone2 || 'N/A'}</span>
                </p>
              </div>

              {/* Action Button */}
              <div className="flex items-center space-x-2 shrink-0">
                <button 
                  onClick={() => {
                    if (onSelectStudent) onSelectStudent(student);
                    setSelectedStudentForCard(student);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-sm transition-all active:scale-95 flex items-center space-x-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  <span>Open Card & Log Counseling</span>
                </button>
              </div>
            </div>

            {/* Performance Indicators Row */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
              <div className={`p-3 rounded-xl border ${attendanceVal < 75 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                <span className="text-[9px] font-black uppercase tracking-widest block opacity-75">Attendance</span>
                <span className="text-sm font-black">{student.attendance ? `${student.attendance}%` : 'N/A'}</span>
                {attendanceVal < 75 && <span className="text-[9px] font-black block text-red-600">🚨 Below 75% Limit</span>}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                <span className="text-[9px] font-black uppercase tracking-widest block opacity-75">CGPA</span>
                <span className="text-sm font-black text-slate-900">{student.cgpa || 'N/A'}</span>
              </div>

              <div className={`p-3 rounded-xl border ${hasRGrade ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                <span className="text-[9px] font-black uppercase tracking-widest block opacity-75">R-Grade (Att. Shortage)</span>
                <span className="text-xs font-black truncate block">{student.rGrade && student.rGrade.toLowerCase() !== 'none' ? student.rGrade : 'None'}</span>
              </div>

              <div className={`p-3 rounded-xl border ${hasIGrade ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                <span className="text-[9px] font-black uppercase tracking-widest block opacity-75">I-Grade (Supply Exam)</span>
                <span className="text-xs font-black truncate block">{student.iGrade && student.iGrade.toLowerCase() !== 'none' ? student.iGrade : 'None'}</span>
              </div>
            </div>

            {/* Risk Factors List */}
            {reasons.length > 0 && (
              <div className="mt-3 bg-red-50/60 p-3 rounded-xl border border-red-100 text-xs font-bold text-red-900">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block mb-1">Identified Risk Factors for Mentoring:</span>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  {reasons.map((r, idx) => (
                    <li key={idx} className="font-semibold">{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {filteredList.length === 0 && (
          <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center">
            <h4 className="text-base font-black text-slate-700">No students match this risk filter</h4>
            <p className="text-xs font-bold text-slate-400 mt-1">Try switching to a different risk tier or resetting your search term.</p>
          </div>
        )}
      </div>

      {/* Selected Student Full Modal Card */}
      {selectedStudentForCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button 
              onClick={() => setSelectedStudentForCard(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <StudentCard student={selectedStudentForCard} currentUser={currentUser} />
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAnalysisDashboard;
