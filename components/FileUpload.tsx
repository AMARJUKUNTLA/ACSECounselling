
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
        // @ts-ignore
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // @ts-ignore
        const results = XLSX.utils.sheet_to_json(worksheet);

        const mappedData: Student[] = results.map((row: any, index: number) => {
          // Normalizing keys to handle case-sensitivity and specific user headers
          const getVal = (keys: string[]) => {
            for (const key of keys) {
              if (row[key] !== undefined) return String(row[key]);
              if (row[key.toLowerCase()] !== undefined) return String(row[key.toLowerCase()]);
              if (row[key.toUpperCase()] !== undefined) return String(row[key.toUpperCase()]);
            }
            return '';
          };

          return {
            regNo: getVal(['SID', 'reg no', 'Reg No']),
            name: getVal(['SNAME', 'name', 'Name']),
            phone1: getVal(['SPHNO', 'phone1', 'Phone1']),
            phone2: getVal(['FPHNO', 'phone2', 'Phone2']),
            counsellor: getVal(['CNAME', 'counante', 'Counante', 'counsellor', 'Counsellor']),
            year: getVal(['YEAR', 'year', 'Year']),
            section: getVal(['SECTION', 'section', 'Section']),
            branch: getVal(['BRANCH', 'branch', 'Branch']),
            id: `student-${index}-${Date.now()}`
          };
        });

        onDataLoaded(mappedData);
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        alert("Failed to parse file. Please ensure it is a valid Excel or CSV file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-200 rounded-2xl bg-white shadow-sm hover:border-blue-400 transition-colors group">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".xlsx, .xls, .csv"
      />
      <div className="mb-4 text-blue-500 group-hover:scale-110 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-800">Upload Student Directory</h3>
      <p className="text-sm text-slate-500 mb-4 text-center">Supported: SID, SNAME, YEAR, SECTION, BRANCH, SPHNO, FPHNO, CNAME (Counsellor)</p>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-all shadow-md active:scale-95"
      >
        {isLoading ? 'Processing...' : 'Select File'}
      </button>
    </div>
  );
};

export default FileUpload;
