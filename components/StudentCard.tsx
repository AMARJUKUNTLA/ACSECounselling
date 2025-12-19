
import React from 'react';
import { Student } from '../types';

interface StudentCardProps {
  student: Student;
}

const StudentCard: React.FC<StudentCardProps> = ({ student }) => {
  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber.replace(/\s+/g, '')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
        <div>
          <h3 className="text-white font-bold text-lg leading-tight uppercase tracking-wide">{student.name || 'Unknown Name'}</h3>
          <p className="text-blue-100 text-sm font-medium">SID: {student.regNo || 'N/A'}</p>
        </div>
        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
           <span className="text-white text-xs font-bold uppercase">{student.branch || 'General'}</span>
        </div>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Details</label>
            <div className="mt-2 space-y-3">
              {/* Student Phone (SPHNO) */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                <div className="flex items-center text-slate-700">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Student (SPHNO)</p>
                    <a href={`tel:${student.phone1}`} className="font-medium text-blue-600 hover:underline">{student.phone1 || 'Not Provided'}</a>
                  </div>
                </div>
                {student.phone1 && (
                  <button 
                    onClick={() => handleCall(student.phone1)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"
                    title="Call Student"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 005.505 5.505l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                  </button>
                )}
              </div>

              {/* Parent Phone (FPHNO) */}
              {student.phone2 && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                  <div className="flex items-center text-slate-700">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Parent (FPHNO)</p>
                      <a href={`tel:${student.phone2}`} className="font-medium text-emerald-600 hover:underline">{student.phone2}</a>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCall(student.phone2)}
                    className="p-2 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                    title="Call Parent"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 005.505 5.505l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Counsellor Assigned</label>
            <p className="mt-1 text-slate-800 font-medium">{student.counsellor || 'Not Assigned'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Year</label>
              <p className="mt-1 text-slate-800 font-bold text-lg leading-none">{student.year || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Section</label>
              <p className="mt-1 text-slate-800 font-bold text-lg leading-none">{student.section || '-'}</p>
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department / Branch</label>
            <p className="mt-1 text-slate-800 font-bold">{student.branch || 'Not Assigned'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;
