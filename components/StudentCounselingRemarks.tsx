import React, { useState, useEffect } from 'react';
import { Student, AppUser, StudentRemark } from '../types';
import { 
  subscribeToRemarksForStudent, 
  addRemarkToFirebase, 
  deleteRemarkFromFirebase 
} from '../services/databaseService';

interface StudentCounselingRemarksProps {
  student: Student;
  currentUser: AppUser;
}

const StudentCounselingRemarks: React.FC<StudentCounselingRemarksProps> = ({ student, currentUser }) => {
  const [remarks, setRemarks] = useState<StudentRemark[]>([]);
  const [newRemark, setNewRemark] = useState('');
  const [category, setCategory] = useState<'counseling' | 'discipline' | 'attendance' | 'academic' | 'general'>('counseling');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToRemarksForStudent(student.id, (data) => {
      setRemarks(data);
    });
    return () => unsubscribe();
  }, [student.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemark.trim()) return;

    setIsSubmitting(true);
    try {
      await addRemarkToFirebase({
        studentId: student.id,
        studentRegNo: student.regNo,
        studentName: student.name,
        facultyId: currentUser.id,
        facultyName: currentUser.name,
        category: category,
        remark: newRemark.trim()
      });
      setNewRemark('');
      setShowForm(false);
    } catch (err) {
      alert("Failed to save counseling remark.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (remarkId: string) => {
    if (window.confirm("Are you sure you want to delete this counseling remark?")) {
      try {
        await deleteRemarkFromFirebase(remarkId);
      } catch (e) {
        alert("Failed to delete remark.");
      }
    }
  };

  const categoryBadges: Record<string, { label: string; color: string }> = {
    counseling: { label: 'Counseling', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    discipline: { label: 'Discipline', color: 'bg-red-100 text-red-700 border-red-200' },
    attendance: { label: 'Attendance', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    academic: { label: 'Academic', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    general: { label: 'General Behavior', color: 'bg-slate-100 text-slate-700 border-slate-200' }
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            <span>Counseling & Behavioral Remarks ({remarks.length})</span>
          </h4>
          <p className="text-[10px] font-bold text-slate-400">Firebase Cloud Recorded Log</p>
        </div>

        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 active:scale-95"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}></path>
          </svg>
          <span>{showForm ? 'Cancel' : 'Add Remark'}</span>
        </button>
      </div>

      {/* Add Remark Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-in fade-in duration-200">
          <div className="mb-3">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Behavior Category</label>
            <select 
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="counseling">Counseling Session</option>
              <option value="discipline">Discipline / Conduct</option>
              <option value="attendance">Attendance Issue</option>
              <option value="academic">Academic Progress</option>
              <option value="general">General Behavior</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Faculty Remarks & Counseling Summary</label>
            <textarea 
              rows={3}
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              placeholder="Enter counseling observations, behavior notes, or parental communication summary..."
              required
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center space-x-2"
          >
            {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            <span>Save Remark to Firebase Cloud</span>
          </button>
        </form>
      )}

      {/* Remarks Timeline */}
      <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
        {remarks.map((r) => {
          const badge = categoryBadges[r.category] || categoryBadges.counseling;
          const canDelete = currentUser.role === 'admin' || currentUser.id === r.facultyId;

          return (
            <div key={r.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl relative group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{r.facultyName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(r.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      title="Delete remark"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-line">{r.remark}</p>
            </div>
          );
        })}

        {remarks.length === 0 && (
          <div className="py-6 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
            <p className="text-xs font-bold">No counseling remarks recorded yet for this student.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCounselingRemarks;
