export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tender {
  id: number;
  title: string;
  reference_number: string;
  description: string;
  organization: string;
  department: string | null;
  category: string;
  subcategory: string | null;
  tender_type: string;
  status: string;
  internal_status: string;
  estimated_value: number | null;
  currency: string;
  published_date: string | null;
  submission_deadline: string;
  opening_date: string | null;
  closing_date: string | null;
  location: string | null;
  state: string | null;
  city: string | null;
  eligibility_criteria: string | null;
  emd_amount: number | null;
  tender_fee: number | null;
  source_url: string | null;
  source_id: number | null;
  source_name: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  notes_count: number;
  documents_count: number;
  is_bookmarked: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenderDocument {
  id: number;
  tender_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  document_type: string;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface TenderNote {
  id: number;
  tender_id: number;
  content: string;
  created_by: number;
  created_by_name: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: number;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  scrape_frequency: string;
  last_scraped_at: string | null;
  total_tenders: number;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: number;
  keyword: string;
  category: string | null;
  is_active: boolean;
  match_count: number;
  created_by: number;
  created_at: string;
}

export interface Alert {
  id: number;
  title: string;
  message: string;
  alert_type: 'deadline' | 'new_tender' | 'status_change' | 'keyword_match' | 'system';
  severity: 'info' | 'warning' | 'error' | 'success';
  tender_id: number | null;
  tender_title: string | null;
  is_read: boolean;
  user_id: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  entity_name: string | null;
  details: Record<string, unknown>;
  performed_by: number;
  performed_by_name: string;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardStats {
  total_tenders: number;
  active_tenders: number;
  closing_soon: number;
  new_today: number;
  total_value: number;
  tenders_by_status: Record<string, number>;
  tenders_by_category: Record<string, number>;
  tenders_by_source: Record<string, number>;
  recent_tenders: Tender[];
  upcoming_deadlines: Tender[];
  monthly_trend: Array<{
    month: string;
    count: number;
    value: number;
  }>;
}

export interface TenderFilters {
  search?: string;
  status?: string;
  internal_status?: string;
  category?: string;
  priority?: string;
  source_id?: number;
  assigned_to?: number;
  date_from?: string;
  date_to?: string;
  min_value?: number;
  max_value?: number;
  state?: string;
  is_bookmarked?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
