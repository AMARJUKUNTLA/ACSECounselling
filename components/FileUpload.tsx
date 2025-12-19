
import React, { useRef } from 'react';
import { Student } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: Student[]) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        // Accessing XLSX from window global provided by index.html script tag
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
          throw new Error("XLSX library not loaded");
        }

        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const results = XLSX.utils.sheet_to_json(worksheet);

        const mappedData: Student[] = results.map((row: any, index: number) => {
          const getVal = (keys: string[]) => {
            for (const key of keys) {
              if (row[key] !== undefined) return String(row[key]).trim();
              if (row[key.toLowerCase()] !== undefined) return String(row[key.toLowerCase()]).trim();
              if (row[key.toUpperCase()] !== undefined) return String(row[key.toUpperCase()]).trim();
            }
            return '';
          };

          return {
            regNo: getVal(['SID', 'reg no', 'Reg No', 'Registration']),
            name: getVal(['SNAME', 'name', 'Name', 'Student Name']),
            phone1: getVal(['SPHNO', 'phone1', 'Phone1', 'Student Phone']),
            phone2: getVal(['FPHNO', 'phone2', 'Phone2', 'Father Phone', 'Parent Phone']),
            counsellor: getVal(['CNAME', 'counante', 'Counante', 'counsellor', 'Counsellor']),
            year: getVal(['YEAR', 'year', 'Year', 'Academic Year']),
            section: getVal(['SECTION', 'section', 'Section', 'Sec']),
            branch: getVal(['BRANCH', 'branch', 'Branch', 'Dept', 'Department']),
            id: `student-${index}-${Date.now()}`
          };
        });

        onDataLoaded(mappedData);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        alert("Failed to parse file. Please ensure it is a valid Excel file with appropriate headers.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-200 rounded-3xl bg-slate-50/50 hover:border-indigo-500 hover:bg-white transition-all group cursor-pointer" onClick={() => !isLoading && fileInputRef.current?.click()}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".xlsx, .xls, .csv"
      />
      <div className="mb-6 w-16 h-16 bg-white rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
      </div>
      <h3 className="text-xl font-black text-slate-800">Drop Student File</h3>
      <p className="text-sm text-slate-400 mt-2 text-center max-w-xs">Supported: .xlsx, .xls, .csv<br/>Headers like SID, SNAME, BRANCH...</p>
      
      <button
        disabled={isLoading}
        className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:bg-slate-300 transition-all shadow-xl shadow-indigo-100 active:scale-95"
      >
        {isLoading ? 'Processing...' : 'Choose File'}
      </button>
    </div>
  );
};

export default FileUpload;
