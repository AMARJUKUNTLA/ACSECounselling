
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';
// Using a fresh, unique bin for global persistence to avoid conflicts
const GLOBAL_BIN_ID = '484c6c21e6be1219b224';
const GLOBAL_KV_URL = `https://api.npoint.io/${GLOBAL_BIN_ID}`; 

export const saveSheetUrl = async (url: string) => {
  // 1. Save locally for immediate persistence
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // 2. Push to Global Cloud Bin using PUT (Full Overwrite)
  try {
    const payload = { 
      active_sheet_url: url,
      last_updated: new Date().toISOString()
    };
    
    const response = await fetch(GLOBAL_KV_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error(`Cloud sync error: ${response.statusText}`);
    console.log("Master link successfully pushed to global cloud.");
  } catch (e) {
    console.error("Critical: Global cloud sync failed.", e);
    // Even if cloud fails, we have it in localStorage for this device
    throw e;
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    // cache: 'no-store' ensures we don't get a stale version from browser cache
    const response = await fetch(`${GLOBAL_KV_URL}?nocache=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    
    if (!response.ok) {
      console.warn("Cloud master bin not reachable or not yet created.");
      return null;
    }
    
    const data = await response.json();
    console.log("Global cloud config fetched:", data);
    return data.active_sheet_url || null;
  } catch (e) {
    console.error("Failed to fetch from global config service:", e);
    return null;
  }
};

export const updateAdminPassword = (newPwd: string) => {
  localStorage.setItem(PWD_KEY, newPwd);
};

export const fetchFromGoogleSheets = async (url: string): Promise<Student[]> => {
  try {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) throw new Error("Invalid Google Sheets URL format");
    
    const spreadsheetId = matches[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Could not fetch CSV from Google Sheets. Ensure the sheet is public.");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
      // Basic CSV splitting (handles quotes/commas simply)
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
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
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor', 'counsellor name']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}-${Date.now()}`
      };
    });
  } catch (e) {
    console.error("Google Sheets data retrieval failed:", e);
    throw e;
  }
};
