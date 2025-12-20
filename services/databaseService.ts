
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';
// The specific bin ID for global persistence
const GLOBAL_BIN_ID = 'ed7d01804f326589312b';
const GLOBAL_KV_URL = `https://api.npoint.io/${GLOBAL_BIN_ID}`; 

export const saveSheetUrl = async (url: string) => {
  // Save locally first
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // Save globally to the cloud bin using PUT to overwrite
  try {
    const response = await fetch(GLOBAL_KV_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_sheet_url: url })
    });
    if (!response.ok) throw new Error("Failed to update cloud master");
    console.log("Global cloud master updated successfully.");
  } catch (e) {
    console.error("Global sync failed, saved locally only.", e);
    throw e;
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    // Adding a cache-buster to ensure we get the latest data
    const response = await fetch(`${GLOBAL_KV_URL}?t=${Date.now()}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.active_sheet_url || null;
  } catch (e) {
    console.error("Failed to fetch global config:", e);
    return null;
  }
};

export const updateAdminPassword = (newPwd: string) => {
  localStorage.setItem(PWD_KEY, newPwd);
};

export const fetchFromGoogleSheets = async (url: string): Promise<Student[]> => {
  try {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) throw new Error("Invalid Google Sheets URL");
    
    const spreadsheetId = matches[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Could not fetch sheet data");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/["']/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const getVal = (keys: string[]) => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== '') return row[key];
        }
        return '';
      };

      return {
        regNo: getVal(['sid', 'reg no', 'registration', 'regno', 'rno']),
        name: getVal(['sname', 'name', 'student name', 'stuname']),
        phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile']),
        phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile']),
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}-${Date.now()}`
      };
    });
  } catch (e) {
    console.error("Google Sheets Fetch Failed", e);
    throw e;
  }
};
