
export interface Student {
  regNo: string;
  name: string;
  phone1: string;
  phone2: string;
  counsellor: string; // Renamed from counante
  year: string;
  section: string;
  branch: string;
  id: string; // Generated internal ID
}

export interface SearchFilters {
  query: string;
  branch?: string;
  year?: string;
  section?: string;
}
