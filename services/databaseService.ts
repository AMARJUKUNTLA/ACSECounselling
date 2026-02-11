
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';

/**
 * MASTER CLOUD BIN
 * This bin stores the 'active_sheet_url' globally.
 * All devices read from this bin on startup and during search.
 */
const GLOBAL_BIN_ID = '7295828475c4078805f2'; 
const GLOBAL_KV_URL = `https://api.npoint.io/${GLOBAL_BIN_ID}`; 

export const saveSheetUrl = async (url: string) => {
  // 1. Save locally for offline/instant access on this device
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // 2. Broadcast to other tabs on the SAME device
  const bc = new BroadcastChannel('edubase_sync');
  bc.postMessage({ type: 'URL_UPDATED', url });
  bc.close();

  const payload = { 
    active_sheet_url: url,
    last_updated: new Date().toISOString(),
    id: GLOBAL_BIN_ID // Keep bin structure consistent
  };

  try {
    // We use PUT for updating existing bins in npoint.io
    const response = await fetch(GLOBAL_KV_URL, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      // If PUT fails, try POST as a fallback
      await fetch(GLOBAL_KV_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    console.log("Master cloud link synchronized successfully.");
  } catch (e) {
    console.warn("Global Cloud Sync failed. This device is updated, but others won't see it until connection is restored.", e);
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    // Force cache-busting to ensure we get the latest data from the cloud
    const response = await fetch(`${GLOBAL_KV_URL}?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.active_sheet_url || null;
  } catch (e) {
    console.error("Global cloud source unreachable.");
    return null;
  }
};

export const updateAdminPassword = (newPwd: string) => {
  localStorage.setItem(PWD_KEY, newPwd);
};

export const fetchFromGoogleSheets = async (url: string): Promise<Student[]> => {
  try {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) throw new Error("Invalid URL");
    
    const spreadsheetId = matches[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Sheet access denied.");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
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
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}-${Date.now()}`
      };
    });
  } catch (e) {
    console.error("Source fetching error:", e);
    throw e;
  }
};
