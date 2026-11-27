import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Star,
  Eye,
  Loader2,
  FileText,
  X,
  AlertTriangle,
  RefreshCw,
  Download,
  SlidersHorizontal,
  Columns3,
  Plus,
  Globe,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { ALL_COUNTRIES, EUROPE, EUROPE_COUNTRY_NAMES, UK, UK_NATIONS, isUkRegion, isLiveRegion, WORLD_BANK, isWorldBankRegion } from '@/lib/countries';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useLiveTenders } from '@/hooks/useLiveTenders';
import { LiveStatus } from '@/components/ui/live-status';
import useAuth, { canEditTenders } from '@/hooks/useAuth';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'interested', label: 'Shortlisted' },
  { value: 'scraped', label: 'Reviewed' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'closed', label: 'Closed' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'All Countries', flag: '🌐' },
  { value: 'India', label: 'India', flag: '🇮🇳' },
  { value: 'USA', label: 'USA', flag: '🇺🇸' },
  { value: 'European Union', label: 'EU', flag: '🇪🇺' },
  { value: 'United Kingdom', label: 'UK', flag: '🇬🇧' },
  { value: 'UAE', label: 'UAE', flag: '🇦🇪' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia', flag: '🇸🇦' },
  { value: 'Qatar', label: 'Qatar', flag: '🇶🇦' },
  { value: 'Australia', label: 'Australia', flag: '🇦🇺' },
  { value: 'Canada', label: 'Canada', flag: '🇨🇦' },
  { value: 'World Bank', label: 'World Bank', flag: '🏦' },
  { value: 'United Nations', label: 'UN', flag: '🇺🇳' },
];

const COUNTRY_MORE = [
  // Middle East
  { value: 'Oman', label: 'Oman' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Bahrain', label: 'Bahrain' },
  { value: 'Jordan', label: 'Jordan' },
  { value: 'Egypt', label: 'Egypt' },
  // Africa
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Tanzania', label: 'Tanzania' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Ethiopia', label: 'Ethiopia' },
  { value: 'Morocco', label: 'Morocco' },
  { value: 'Algeria', label: 'Algeria' },
  { value: 'Tunisia', label: 'Tunisia' },
  { value: 'Senegal', label: 'Senegal' },
  { value: "Côte d'Ivoire", label: "Côte d'Ivoire" },
  { value: 'Uganda', label: 'Uganda' },
  { value: 'Rwanda', label: 'Rwanda' },
  { value: 'Cameroon', label: 'Cameroon' },
  { value: 'Botswana', label: 'Botswana' },
  { value: 'Zambia', label: 'Zambia' },
  // SE Asia
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Vietnam', label: 'Vietnam' },
  // East Asia & Pacific
  { value: 'Japan', label: 'Japan' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'New Zealand', label: 'New Zealand' },
  // Europe (non-EU)
  { value: 'Norway', label: 'Norway' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Turkey', label: 'Turkey' },
  // Americas
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Chile', label: 'Chile' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Ecuador', label: 'Ecuador' },
  { value: 'Panama', label: 'Panama' },
  // South Asia
  { value: 'Bangladesh', label: 'Bangladesh' },
  { value: 'Sri Lanka', label: 'Sri Lanka' },
  { value: 'Nepal', label: 'Nepal' },
  { value: 'Maldives', label: 'Maldives' },
  // Central Asia
  { value: 'Kazakhstan', label: 'Kazakhstan' },
  { value: 'Uzbekistan', label: 'Uzbekistan' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Azerbaijan', label: 'Azerbaijan' },
  { value: 'Kyrgyzstan', label: 'Kyrgyzstan' },
  { value: 'Armenia', label: 'Armenia' },
  // Multilateral / dev banks
  { value: 'Asian Development Bank', label: 'Asian Development Bank' },
  { value: 'African Development Bank', label: 'African Development Bank' },
  { value: 'Inter-American Development Bank', label: 'Inter-American Dev Bank' },
  { value: 'EBRD', label: 'EBRD' },
  { value: 'AIIB', label: 'AIIB' },
  { value: 'Islamic Development Bank', label: 'Islamic Development Bank' },
  { value: 'New Development Bank', label: 'New Development Bank' },
  { value: 'European Investment Bank', label: 'European Investment Bank' },
  { value: 'KfW', label: 'KfW (Germany)' },
  { value: 'JICA', label: 'JICA (Japan)' },
  { value: 'FCDO', label: 'FCDO (UK)' },
  { value: 'USAID', label: 'USAID' },
  // Misc
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Global', label: 'Global (Oil & Gas)' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories', color: 'bg-gray-100 text-gray-600' },
  { value: 'Port', label: 'Port', color: 'bg-blue-100 text-blue-700' },
  { value: 'Jetty', label: 'Jetty', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Wharf', label: 'Wharf', color: 'bg-teal-100 text-teal-700' },
  { value: 'Breakwater', label: 'Breakwater', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Harbour', label: 'Harbour', color: 'bg-sky-100 text-sky-700' },
  { value: 'Dredging', label: 'Dredging', color: 'bg-amber-100 text-amber-700' },
  // Company focus list (Nov 2026) — the server sends the full list with counts;
  // this is only the fallback when that request fails
  { value: 'Reclamation', label: 'Reclamation', color: 'bg-amber-100 text-amber-700' },
  { value: 'Marine Structures', label: 'Marine Structures', color: 'bg-blue-100 text-blue-700' },
  { value: 'Quay', label: 'Quay', color: 'bg-teal-100 text-teal-700' },
  { value: 'Terminal', label: 'Terminal', color: 'bg-sky-100 text-sky-700' },
  { value: 'Offshore', label: 'Offshore', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Piling & Foundations', label: 'Piling & Foundations', color: 'bg-slate-100 text-slate-700' },
  { value: 'Desilting', label: 'Desilting', color: 'bg-amber-100 text-amber-700' },
  { value: 'Intake & Outfall', label: 'Intake & Outfall', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Pipeline', label: 'Pipeline', color: 'bg-slate-100 text-slate-700' },
  { value: 'Tunnelling', label: 'Tunnelling', color: 'bg-stone-100 text-stone-700' },
  { value: 'Trenching', label: 'Trenching', color: 'bg-stone-100 text-stone-700' },
  { value: 'HDD', label: 'HDD (directional drilling)', color: 'bg-orange-100 text-orange-700' },
  { value: 'Subsea Cable', label: 'Subsea Cable', color: 'bg-violet-100 text-violet-700' },
  { value: 'Marine Survey', label: 'Marine Survey', color: 'bg-lime-100 text-lime-700' },
  { value: 'MLD', label: 'MLD (water plants)', color: 'bg-blue-100 text-blue-700' },
  { value: 'Maritime', label: 'Maritime', color: 'bg-blue-100 text-blue-700' },
  { value: 'Dock', label: 'Dock', color: 'bg-slate-100 text-slate-700' },
  { value: 'Berth', label: 'Berth', color: 'bg-violet-100 text-violet-700' },
  { value: 'Shipping', label: 'Shipping', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Cargo', label: 'Cargo', color: 'bg-orange-100 text-orange-700' },
  { value: 'Vessel', label: 'Vessel', color: 'bg-purple-100 text-purple-700' },
  { value: 'Tugboat', label: 'Tugboat', color: 'bg-rose-100 text-rose-700' },
  { value: 'Navigation', label: 'Navigation', color: 'bg-lime-100 text-lime-700' },
  { value: 'Coastal', label: 'Coastal', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Waterway', label: 'Waterway', color: 'bg-blue-100 text-blue-700' },
  { value: 'Shipbuilding', label: 'Shipbuilding', color: 'bg-fuchsia-100 text-fuchsia-700' },
  { value: 'Ship Repair', label: 'Ship Repair', color: 'bg-pink-100 text-pink-700' },
  { value: 'Railway', label: 'Railway', color: 'bg-red-100 text-red-700' },
  { value: 'Construction', label: 'Construction', color: 'bg-orange-100 text-orange-700' },
  { value: 'Road', label: 'Road', color: 'bg-gray-100 text-gray-700' },
  { value: 'Maintenance', label: 'Maintenance', color: 'bg-green-100 text-green-700' },
  { value: 'Consultancy', label: 'Consultancy', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Procurement', label: 'Procurement', color: 'bg-emerald-100 text-emerald-700' },
];

/** Small label for tenders matching the company keyword list (listed first). */
const FocusLabel = () => (
  <span
    title="Matches your focus keywords — listed first"
    className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"
  >
    Focus
  </span>
);

/** Deadline already passed? (No deadline = not shown as closed.) */
const isClosedTender = (t) => !!t.submission_deadline && new Date(t.submission_deadline).getTime() < Date.now();

function TendersPageContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tenders, setTenders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sources, setSources] = useState([]);
  const [regionFacets, setRegionFacets] = useState([]);
  // Live count of open Europe tenders (TED) — counted, not stored
  const [europeTotal, setEuropeTotal] = useState(null);
  const [ukTotal, setUkTotal] = useState(null);
  const [wbTotal, setWbTotal] = useState(null);
  const [wbCountries, setWbCountries] = useState([]);
  // Which live regions are switched on in Admin → Sources
  const [liveActive, setLiveActive] = useState({ ted: true, fts: true, worldbank: true });
  const [sectorFacets, setSectorFacets] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || '');
  // Europe (TED) and UK (Find a Tender) regions are loaded live (not stored); they can also filter by city
  // Viewers are read-only (no shortlist stars)
  const canEdit = canEditTenders(useAuth((s) => s.user));
  const europeMode = isLiveRegion(selectedCountry);
  const ukMode = isUkRegion(selectedCountry);
  const wbMode = isWorldBankRegion(selectedCountry);
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  const [cityInput, setCityInput] = useState(searchParams.get('city') || '');
  const [liveInfo, setLiveInfo] = useState(null);
  // How the server understood the search (topic or words + synonyms)
  const [searchUnderstood, setSearchUnderstood] = useState(null);
  // With a search: how many results are still open (they are listed first)
  const [openTotal, setOpenTotal] = useState(null);
  const [density, setDensity] = useState('compact');
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    source_id: searchParams.get('source_id') ? Number(searchParams.get('source_id')) : undefined,
    state: searchParams.get('state') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    page: Number(searchParams.get('page')) || 1,
    page_size: 20,
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: searchParams.get('sort_order') || 'desc',
  });

  // The header search bar navigates to /tenders?search=…; apply it whenever it
  // changes, even when this page is already open.
  const urlSearch = searchParams.get('search') || '';
  useEffect(() => {
    setFilters((prev) => (prev.search === urlSearch ? prev : { ...prev, search: urlSearch, page: 1 }));
  }, [urlSearch]);

  // silent: refresh the list in place (live updates) without the loading state
  const fetchTenders = useCallback(async (silent = false) => {
    try {
      if (silent !== true) setLoading(true);
      setError(null);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.internal_status = filters.status;
      if (filters.source_id) params.source_id = filters.source_id;
      if (filters.state) params.state = filters.state;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.min_value) params.min_value = filters.min_value;
      if (filters.max_value) params.max_value = filters.max_value;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedCountry) params.country = selectedCountry;
      if (europeMode && selectedCity) params.city = selectedCity;
      params.page = filters.page || 1;
      params.page_size = filters.page_size || 20;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_order) params.sort_order = filters.sort_order;
      // Dredging, marine, pipeline and shipping tenders first, then the chosen order
      params.priority_first = 1;

      const res = await api.get('/tenders', { params });
      setTenders(res.data.items);
      setLiveInfo(res.data.live_source ? { source: res.data.live_source, defaultSectors: res.data.default_sectors, syncedAt: res.data.synced_at, inactive: !!res.data.inactive, detail: res.data.detail } : null);
      setTotal(res.data.total);
      setSearchUnderstood(res.data.search_understood || null);
      setOpenTotal(typeof res.data.open_total === 'number' ? res.data.open_total : null);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tenders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedCategory, selectedCountry, selectedCity, europeMode]);

  const fetchSources = useCallback(async () => {
    try {
      const res = await api.get('/sources');
      setSources(res.data.items || res.data || []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchFacets = useCallback(async () => {
    try {
      const res = await api.get('/tenders/facets');
      setRegionFacets(res.data.regions || []);
      setEuropeTotal(res.data.europe_total ?? null);
      setUkTotal(res.data.uk_total ?? null);
      setWbTotal(res.data.worldbank_total ?? null);
      setWbCountries(res.data.worldbank_countries || []);
      if (res.data.live_active) setLiveActive(res.data.live_active);
      setSectorFacets(res.data.sectors || []);
    } catch {
      // non-critical — dropdowns fall back to hardcoded lists
    }
  }, []);

  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  // Live: new GeM tenders show up in the list by themselves
  // Live regions (TED / Find a Tender / World Bank): re-check every minute while the page
  // is open. The server refreshes each source every 5 minutes, so this costs the source nothing.
  const seenLiveIds = useRef(null);
  useEffect(() => {
    seenLiveIds.current = null;
    if (!europeMode) return undefined;
    const tick = () => document.visibilityState === 'visible' && fetchTenders(true);
    const timer = setInterval(tick, 60 * 1000);
    return () => clearInterval(timer);
  }, [europeMode, fetchTenders]);
  useEffect(() => {
    if (!europeMode || !liveInfo) return;
    const ids = new Set(tenders.map((t) => t.id));
    if (seenLiveIds.current && (filters.page || 1) === 1) {
      const fresh = [...ids].filter((id) => !seenLiveIds.current.has(id)).length;
      if (fresh > 0) toast.success(`${fresh} new ${liveInfo.source} tender${fresh === 1 ? '' : 's'}`, { id: 'live-region-new' });
    }
    seenLiveIds.current = new Set([...(seenLiveIds.current || []), ...ids]);
  }, [tenders]); // eslint-disable-line react-hooks/exhaustive-deps

  const { sync } = useLiveTenders((count) => {
    if (europeMode) return; // new GeM tenders don't change the live TED view
    fetchTenders(true);
    fetchFacets();
    toast.success(`${count.toLocaleString()} new tender${count === 1 ? '' : 's'} added`, { id: 'live-new' });
  });

  useEffect(() => {
    fetchSources();
    fetchFacets();
  }, [fetchSources, fetchFacets]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const handleSort = (column) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const handleShortlist = async (tenderId, e) => {
    e.preventDefault();
    e.stopPropagation();
    // Star toggles: shortlist, or remove from the shortlist if already starred
    const current = tenders.find((t) => t.id === tenderId);
    const next = current?.internal_status === 'interested' ? 'new' : 'interested';
    try {
      await api.patch(`/tenders/${tenderId}`, { internal_status: next });
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, internal_status: next } : t)),
      );
      toast.success(next === 'interested' ? 'Added to Shortlisted' : 'Removed from Shortlisted', { id: 'shortlist' });
    } catch {
      // error handled by interceptor
    }
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedCountry('');
    setSelectedCity('');
    setCityInput('');
    setFilters({
      search: '',
      status: '',
      source_id: undefined,
      state: '',
      date_from: '',
      date_to: '',
      min_value: undefined,
      max_value: undefined,
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    // Also drop ?search= so the header search box clears
    if (urlSearch) navigate('/tenders', { replace: true });
  };

  const SortIcon = ({ column }) => {
    if (filters.sort_by !== column) return <ChevronUp className="h-3 w-3 text-gray-300" />;
    return filters.sort_order === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ChevronDown className="h-3 w-3 text-blue-600" />
    );
  };

  const handleDownloadCSV = () => {
    if (!tenders.length) return;
    const headers = ['Title', 'Reference No', 'Client', 'Category', 'Source', 'Estimated Value', 'Deadline', 'Status', 'Location', 'Source URL'];
    const rows = tenders.map((t) => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.reference_number || ''}"`,
      `"${(t.organization || '').replace(/"/g, '""')}"`,
      `"${t.category || ''}"`,
      `"${t.source_name || ''}"`,
      t.estimated_value || '',
      t.submission_deadline || '',
      t.internal_status || t.status || '',
      `"${[t.city, t.state, t.location].filter(Boolean).join(', ')}"`,
      t.source_url || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);

  const handleExtractCosts = async () => {
    try {
      setExtracting(true);
      setExtractResult(null);
      const res = await api.post('/extract-costs');
      const d = res.data;
      setExtractResult(`Updated ${d.updated_from_text + d.updated_from_detail} tenders (${d.updated_from_text} from text, ${d.updated_from_detail} from detail pages). ${d.still_missing} still missing.`);
      fetchTenders();
    } catch (err) {
      setExtractResult(err instanceof Error ? err.message : 'Failed to extract costs');
    } finally {
      setExtracting(false);
    }
  };

  const hasActiveFilters =
    filters.status || filters.source_id || filters.state || filters.date_from || filters.date_to || filters.min_value || filters.max_value || selectedCategory || selectedCountry || filters.search;

  const activeFilterCount = [
    filters.status,
    filters.source_id,
    filters.state,
    filters.date_from,
    filters.date_to,
    filters.min_value,
    filters.max_value,
    selectedCategory,
    selectedCountry,
    filters.search,
  ].filter(Boolean).length;

  const fromIdx = total ? (filters.page - 1) * filters.page_size + 1 : 0;
  // Divider before the first closed tender (search results list open ones first)
  const firstClosedIdx = (() => {
    if (!filters.search || openTotal === null || openTotal >= total) return -1;
    const i = tenders.findIndex(isClosedTender);
    if (i < 0) return -1;
    // On a later page the closed group may start at the very first row
    return i > 0 || fromIdx - 1 === openTotal ? i : -1;
  })();
  const closedDividerText = `Closed tenders — deadline passed (${(total - (openTotal || 0)).toLocaleString()})`;
  const toIdx = Math.min(filters.page * filters.page_size, total);

  // Density-driven row padding
  const rowPad = density === 'compact' ? 'py-2.5' : density === 'standard' ? 'py-4' : 'py-6';

  // Compact pagination range "1 2 3 … N"
  const pageNumbers = (() => {
    const cur = filters.page ?? 1;
    const last = Math.max(1, totalPages);
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    if (cur <= 3) return [1, 2, 3, '…', last];
    if (cur >= last - 2) return [1, '…', last - 2, last - 1, last];
    return [1, '…', cur - 1, cur, cur + 1, '…', last];
  })();

  // Status → label + colour for top-of-table badges
  const statusBadge = (raw) => {
    const s = (raw || 'new').toLowerCase();
    if (['new', 'open', 'scraped', 'live'].includes(s))
      return { label: 'OPEN', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' };
    if (['interested', 'shortlisted', 'reviewing', 'review', 'in_review'].includes(s))
      return { label: 'UNDER REVIEW', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' };
    if (['pending', 'awaiting', 'submitted'].includes(s))
      return { label: 'PENDING', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
    if (['awarded', 'won'].includes(s))
      return { label: 'AWARDED', cls: 'bg-violet-50 text-violet-700 ring-violet-600/20' };
    if (['closed', 'lost', 'rejected'].includes(s))
      return { label: 'CLOSED', cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' };
    return { label: getStatusLabel(s).toUpperCase(), cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' };
  };


  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Global Tenders</h1>
          {europeMode && liveInfo ? (
            <LiveStatus sync={{ last_success_at: liveInfo.syncedAt }} label={liveInfo.source} className="mt-1" />
          ) : (
            <LiveStatus sync={sync} className="mt-1" />
          )}
        </div>
      </div>

      {/* Top control row: Advanced Filters | density | results | Export / Columns */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[11px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Density toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            {['compact', 'standard', 'relaxed'].map((d) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  density === d ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          <span className="hidden h-6 w-px bg-gray-200 lg:block" />
          <p className="text-sm text-gray-500">
            Viewing <span className="font-medium text-gray-900">{fromIdx}-{toIdx}</span> of{' '}
            <span className="font-medium text-gray-900">{total.toLocaleString()}</span> results
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleDownloadCSV}
            disabled={!tenders.length}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleExtractCosts}
            loading={extracting}
            disabled={extracting}
            title="Extract costs from selected tenders"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </Button>
        </div>
      </div>

      {extractResult && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
          {extractResult}
        </div>
      )}

      {/* How the search was understood: a whole topic from the keyword list, or
          words (each with its synonyms / plurals) that must all appear */}
      {filters.search && searchUnderstood && searchUnderstood.groups?.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600">
          <Search className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <p className="min-w-0">
            <span className="font-medium text-gray-900">Searching for “{filters.search}”</span>
            {searchUnderstood.topic ? ' — any of: ' : ' — '}
            {searchUnderstood.topic
              ? searchUnderstood.groups[0].slice(0, 12).join(', ') + (searchUnderstood.groups[0].length > 12 ? ' …' : '')
              : searchUnderstood.groups
                  .map((g) => (g.length > 1 ? `(${g.slice(0, 4).join(' / ')})` : g[0]))
                  .join(' + ')}
            <span className="text-gray-400"> · in titles, work descriptions, buyers and places; bid numbers too</span>
            {openTotal !== null && (
              <span className="mt-1 block text-gray-700">
                <span className="font-medium text-gray-900">{openTotal.toLocaleString()} open</span> listed first
                {total - openTotal > 0 && <>, then {(total - openTotal).toLocaleString()} closed</>}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Region / Sector / Contract Value filter card — on phones it stays folded
          until "Advanced Filters" is tapped, so the tender list is visible first */}
      <div className={`${showFilters ? 'block' : 'hidden'} rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm sm:p-5 md:block`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Region
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedCity('');
                setCityInput('');
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                All Regions
                {regionFacets.length > 0 && ` (${regionFacets.reduce((s, r) => s + r.count, 0)})`}
              </option>
              {/* Countries that have tenders first (with counts), then every other country */}
              {regionFacets.length > 0 && (
                <optgroup label="With tenders">
                  {regionFacets.map((r) => {
                    const opt = ALL_COUNTRIES.find((c) => c.value === r.country);
                    return (
                      <option key={`has-${r.country}`} value={r.country}>
                        {opt?.flag ? `${opt.flag} ` : ''}
                        {r.country} ({r.count})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {liveActive.ted !== false && (
              <optgroup label="Europe — live from TED">
                <option value={EUROPE}>
                  🇪🇺 All Europe{europeTotal != null ? ` (${europeTotal.toLocaleString()})` : ''}
                </option>
                {EUROPE_COUNTRY_NAMES.map((name) => {
                  const opt = ALL_COUNTRIES.find((c) => c.value === name);
                  return (
                    <option key={`eu-${name}`} value={name}>
                      {opt?.flag} {name}
                    </option>
                  );
                })}
              </optgroup>
              )}
              {liveActive.fts !== false && (
              <optgroup label="United Kingdom — live from Find a Tender">
                <option value={UK}>
                  🇬🇧 All UK{ukTotal != null ? ` (${ukTotal.toLocaleString()})` : ''}
                </option>
                {UK_NATIONS.map((name) => (
                  <option key={`uk-${name}`} value={name}>
                    🇬🇧 {name}
                  </option>
                ))}
              </optgroup>
              )}
              {liveActive.worldbank !== false && (
              <optgroup label="Worldwide — live from the World Bank">
                <option value={WORLD_BANK}>
                  🏦 All World Bank countries{wbTotal != null ? ` (${wbTotal.toLocaleString()})` : ''}
                </option>
                {wbCountries.map((c) => (
                  <option key={c.value} value={c.value}>
                    🏦 {c.label} ({c.open} open)
                  </option>
                ))}
              </optgroup>
              )}
              {/* No "United Nations" option: UNGM (where UN agencies publish) blocks automated access */}
              <optgroup label="All countries">
                {ALL_COUNTRIES.filter((c) => !regionFacets.some((r) => r.country === c.value) && !EUROPE_COUNTRY_NAMES.includes(c.value) && c.value !== UK).map((opt) => (
                  <option key={opt.code} value={opt.value}>
                    {opt.flag} {opt.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Sector
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                {europeMode
                  ? `Marine, dredging & pipelines${!selectedCategory && !loading ? ` (${total.toLocaleString()})` : ''}`
                  : 'All Categories'}
                {!europeMode && sectorFacets.length > 0 &&
                  ` (${sectorFacets.reduce((s, x) => s + x.count, 0)})`}
              </option>
              {sectorFacets.length > 0
                ? (() => {
                    const renderOption = (s) => (
                      <option key={s.sector} value={s.sector}>
                        {s.sector}
                        {europeMode
                          ? selectedCategory === s.sector && !loading ? ` (${total.toLocaleString()})` : ''
                          : ` (${s.count})`}
                      </option>
                    );
                    // The company's focus sectors (its keyword list) on top, then every other sector
                    // Same order as tender priority: focus sectors, then the middle group (Procurement), then the rest
                    const focus = sectorFacets.filter((s) => s.focus);
                    const middle = sectorFacets.filter((s) => s.group === 'middle');
                    const other = sectorFacets.filter((s) => !s.focus && s.group !== 'middle');
                    return focus.length > 0 ? (
                      <>
                        <optgroup label="Your focus sectors">{focus.map(renderOption)}</optgroup>
                        {middle.length > 0 && <optgroup label="Next priority">{middle.map(renderOption)}</optgroup>}
                        <optgroup label="Other sectors">{other.map(renderOption)}</optgroup>
                      </>
                    ) : (
                      sectorFacets.map(renderOption)
                    );
                  })()
                : CATEGORY_OPTIONS.slice(1).map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
            </select>
          </div>
          {europeMode ? (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              City
            </label>
            <Input
              placeholder={ukMode ? 'e.g. Aberdeen, Lerwick' : wbMode ? 'e.g. Maputo, Dhaka' : 'e.g. Rotterdam, Hamburg'}
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSelectedCity(cityInput.trim());
                  setFilters((prev) => ({ ...prev, page: 1 }));
                }
              }}
              onBlur={() => {
                if (cityInput.trim() !== selectedCity) {
                  setSelectedCity(cityInput.trim());
                  setFilters((prev) => ({ ...prev, page: 1 }));
                }
              }}
            />
          </div>
          ) : (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Contract Value
            </label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Min"
                type="number"
                value={filters.min_value || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    min_value: e.target.value ? Number(e.target.value) : undefined,
                    page: 1,
                  }))
                }
              />
              <span className="text-gray-400">-</span>
              <Input
                placeholder="Max"
                type="number"
                value={filters.max_value || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    max_value: e.target.value ? Number(e.target.value) : undefined,
                    page: 1,
                  }))
                }
              />
            </div>
          </div>
          )}
          <div className="flex items-end gap-2">
            {hasActiveFilters && (
              <Button variant="outline" size="md" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
            <Button variant="primary" size="md" onClick={fetchTenders}>
              Apply{activeFilterCount ? ` ${activeFilterCount} Active` : ''} Filters
            </Button>
          </div>
        </div>
      </div>

      {europeMode && liveInfo?.inactive && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{liveInfo.detail}</div>
      )}
      {europeMode && !liveInfo?.inactive && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <p>
            {wbMode ? (
              <>
                <span className="font-medium text-gray-900">Live from the World Bank</span> — open notices for World Bank–financed
                projects, nothing is stored. Notices in French, Spanish or Portuguese are matched to your categories in English
                (titles translated when available).{' '}
              </>
            ) : ukMode ? (
              <>
                <span className="font-medium text-gray-900">Live from Find a Tender</span>, the UK government's official tender
                service — open tenders only, nothing is stored.{' '}
              </>
            ) : (
              <>
                <span className="font-medium text-gray-900">Live from TED</span>, the EU's official tender journal — open
                calls for tender only, nothing is stored.{' '}
              </>
            )}
            {(!selectedCategory) && 'Showing dredging, marine, pipeline & shipping tenders — pick a Sector to see others. '}
            Open a tender for its documents and how to apply.
          </p>
        </div>
      )}

      {/* Hidden legacy category chips kept for SEO/bookmarks but not displayed */}
      <div className="hidden">
        {CATEGORY_OPTIONS.map((cat) => {
          const isActive = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => {
                setSelectedCategory(cat.value);
                setFilters(prev => ({ ...prev, page: 1 }));
              }}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
                isActive
                  ? `${cat.color} border-current ring-2 ring-offset-1 ring-current/20 shadow-sm`
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Country - hidden (replaced by Region dropdown above) */}
      <div className="hidden flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Country:</span>
        {COUNTRY_OPTIONS.map((opt) => {
          const isActive = selectedCountry === opt.value;
          return (
            <button
              key={opt.value || 'all'}
              onClick={() => {
                setSelectedCountry(opt.value);
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span aria-hidden>{opt.flag}</span>
              {opt.label}
            </button>
          );
        })}
        {/* More countries dropdown */}
        <select
          value={
            COUNTRY_MORE.some((c) => c.value === selectedCountry) ? selectedCountry : ''
          }
          onChange={(e) => {
            setSelectedCountry(e.target.value);
            setFilters((prev) => ({ ...prev, page: 1 }));
          }}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 ${
            COUNTRY_MORE.some((c) => c.value === selectedCountry)
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:ring-indigo-200'
          }`}
        >
          <option value="">More countries…</option>
          {COUNTRY_MORE.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Estimated Value - hidden (replaced by Min/Max in filter card above) */}
      <div className="hidden flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Estimated Value:</span>
        {[
          { label: 'All Values', min: undefined, max: undefined },
          { label: '₹5Cr - ₹10Cr', min: 50000000, max: 100000000 },
          { label: '₹10Cr - ₹25Cr', min: 100000000, max: 250000000 },
          { label: '₹25Cr - ₹50Cr', min: 250000000, max: 500000000 },
          { label: '₹50Cr - ₹100Cr', min: 500000000, max: 1000000000 },
          { label: '₹100Cr - ₹500Cr', min: 1000000000, max: 5000000000 },
          { label: 'Above ₹500Cr', min: 5000000000, max: undefined },
        ].map((range) => {
          const isActive =
            filters.min_value === range.min && filters.max_value === range.max;
          return (
            <button
              key={range.label}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  min_value: range.min,
                  max_value: range.max,
                  page: 1,
                }));
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {/* Expandable filter row */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* Other Filters */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Source</label>
              <select
                value={filters.source_id || ''}
                onChange={(e) =>
                  updateFilter('source_id', e.target.value ? Number(e.target.value) : undefined)
                }
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">All Sources</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Location</label>
              <Input
                placeholder="State or city..."
                value={filters.state || ''}
                onChange={(e) => updateFilter('state', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">From Date</label>
              <Input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => updateFilter('date_from', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">To Date</label>
              <Input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => updateFilter('date_to', e.target.value)}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Data table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
            <p className="text-sm text-gray-600">{error}</p>
            <Button onClick={fetchTenders} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : tenders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No tenders found</p>
            <p className="mt-1 text-sm text-gray-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <>
            {/* Desktop only: table (lg and up) */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="w-[3%] px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </th>
                    <th
                      onClick={() => handleSort('title')}
                      className="w-[25%] cursor-pointer px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                    >
                      <span className="inline-flex items-center gap-1">
                        Tender Title
                        <SortIcon column="title" />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('category')}
                      className="w-[11%] cursor-pointer px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                    >
                      Sector
                    </th>
                    <th className="w-[11%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Region
                    </th>
                    <th
                      onClick={() => handleSort('internal_status')}
                      className="w-[9%] cursor-pointer px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                    >
                      Status
                    </th>
                    <th
                      onClick={() => handleSort('submission_deadline')}
                      className="w-[10%] cursor-pointer px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                    >
                      Deadline
                    </th>
                    <th
                      onClick={() => handleSort('estimated_value')}
                      className="w-[12%] cursor-pointer px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                    >
                      Estimated Value
                    </th>
                    <th className="w-[11%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Internal Notes
                    </th>
                    <th className="w-[8%] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenders.map((tender, idx) => {
                    const rawStatus = String(tender.internal_status || tender.status || 'new').toLowerCase();
                    const badge = tender.is_live
                      ? { label: 'Live', cls: 'bg-gray-50 text-gray-600 ring-gray-200' }
                      // Deadline passed and nobody worked on it: "CLOSED", not "OPEN"
                      : isClosedTender(tender) && ['new', 'open', 'scraped', 'live'].includes(rawStatus)
                        ? { label: 'CLOSED', cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' }
                        : statusBadge(rawStatus);
                    return (
                      <React.Fragment key={tender.id}>
                      {idx === firstClosedIdx && (
                        <tr>
                          <td colSpan={10} className="bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            {closedDividerText}
                          </td>
                        </tr>
                      )}
                      <tr
                        className="group transition-colors hover:bg-gray-50/70"
                      >
                        <td className={`px-4 ${rowPad}`} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          <Link
                            to={`/tenders/${tender.id}`}
                            className="block min-w-0"
                          >
                            <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                              {tender.title}
                            </p>
                            {tender.reference_number && (
                              <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                                {tender.priority_level === 3 && <span className="mr-1.5 align-middle font-sans"><FocusLabel /></span>}
                                {tender.reference_number}
                              </p>
                            )}
                            {tender.original_language && (
                              <p className="mt-0.5 truncate text-[11px] text-gray-500">
                                {tender.original_title ? `Translated from ${tender.original_language}` : `${tender.original_language} notice`}
                              </p>
                            )}
                          </Link>
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          {(() => {
                            const cats = (tender.categories || [tender.category]).filter(Boolean);
                            const primary = cats[0];
                            if (!primary) return <span className="text-gray-300">-</span>;
                            const opt = CATEGORY_OPTIONS.find((c) => c.value === primary);
                            const cls = opt?.color || 'bg-gray-100 text-gray-600';
                            return (
                              <div className="flex flex-wrap gap-1">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                                  {primary}
                                </span>
                                {cats.length > 1 && (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                                    +{cats.length - 1}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          {(() => {
                            const country = tender.country;
                            if (!country) return <span className="text-gray-300">-</span>;
                            const opt = COUNTRY_OPTIONS.find((c) => c.value === country);
                            return (
                              <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                                <span aria-hidden>{opt?.flag || '📍'}</span>
                                <span className="truncate">{tender.city ? `${tender.city}, ` : ''}{country}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className={`px-4 ${rowPad} text-sm text-gray-700`}>
                          {formatDate(tender.submission_deadline)}
                          {isClosedTender(tender) && (
                            <span className="mt-0.5 block text-[11px] font-medium text-gray-500">Closed</span>
                          )}
                        </td>
                        <td className={`px-4 ${rowPad} text-right font-mono text-sm text-gray-900`}>
                          {tender.estimated_value
                            ? formatCurrency(tender.estimated_value, tender.currency || tender.estimated_cost_currency || 'INR')
                            : <span className="text-gray-300">-</span>}
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          {tender.is_live ? (
                            <span className="text-xs text-gray-400">Live · {tender.source_name}</span>
                          ) : (
                          <Link
                            to={`/tenders/${tender.id}#notes`}
                            className="block truncate text-sm italic text-gray-400 hover:text-gray-600 hover:not-italic"
                          >
                            Click to add note...
                          </Link>
                          )}
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => handleShortlist(tender.id, e)}
                              title={tender.internal_status === 'interested' ? 'Remove from shortlist' : 'Shortlist tender'}
                              className={`${tender.is_live || !canEdit ? 'hidden ' : ''}rounded-lg p-1.5 transition-colors ${
                                tender.internal_status === 'interested'
                                  ? 'text-amber-500 hover:bg-amber-50'
                                  : 'text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                              }`}
                            >
                              <Star
                                className="h-4 w-4"
                                fill={tender.internal_status === 'interested' ? 'currentColor' : 'none'}
                              />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (tender.source_url) window.open(tender.source_url, '_blank');
                              }}
                              disabled={!tender.source_url}
                              title="Download / open source"
                              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile + tablet: stacked cards (below lg) */}
            <ul className="xl:hidden divide-y divide-gray-100">
              {tenders.map((tender, idx) => {
                const cats = (tender.categories || [tender.category]).filter(Boolean).slice(0, 2);
                return (
                  <React.Fragment key={tender.id}>
                  {idx === firstClosedIdx && (
                    <li className="bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      {closedDividerText}
                    </li>
                  )}
                  <li
                    className="px-4 py-3 active:bg-blue-50/40 transition-colors"
                    onClick={() => navigate(`/tenders/${tender.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                        {tender.title}
                      </p>
                      <span
                        className={`flex-shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tender.is_live ? 'border-gray-200 text-gray-600' : getStatusColor(tender.internal_status || tender.status)}`}
                      >
                        {tender.is_live ? 'Live' : getStatusLabel(tender.internal_status || tender.status)}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-gray-400">
                      {tender.reference_number}
                    </p>
                    {tender.organization && (
                      <p className="mt-1 truncate text-xs text-gray-600">{tender.organization}</p>
                    )}
                    {tender.is_live && tender.location && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">{tender.location}</p>
                    )}
                    {tender.original_language && (
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {tender.original_title ? `Translated from ${tender.original_language}` : `${tender.original_language} notice`}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {tender.priority_level === 3 && <FocusLabel />}
                      {tender.estimated_value && (
                        <span className="font-medium text-gray-700">{formatCurrency(tender.estimated_value, tender.currency || tender.estimated_cost_currency || 'INR')}</span>
                      )}
                      {isClosedTender(tender) ? (
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                          Closed {formatDate(tender.submission_deadline)}
                        </span>
                      ) : (
                        <span>Due {formatDate(tender.submission_deadline)}</span>
                      )}
                      {tender.source_name && (
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {tender.source_name}
                        </span>
                      )}
                    </div>
                    {cats.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cats.map((cat, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/tenders/${tender.id}`);
                        }}
                        title="View tender"
                        className="rounded-lg p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleShortlist(tender.id, e)}
                        title={tender.internal_status === 'interested' ? 'Remove from shortlist' : 'Shortlist tender'}
                        className={`${tender.is_live || !canEdit ? 'hidden ' : ''}rounded-lg p-2 ${
                          tender.internal_status === 'interested'
                            ? 'text-amber-500 hover:bg-amber-50'
                            : 'text-gray-500 hover:bg-amber-50 hover:text-amber-500'
                        }`}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={tender.internal_status === 'interested' ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>
                  </li>
                  </React.Fragment>
                );
              })}
            </ul>

            {/* Load-more affordance + pagination */}
            {filters.page < totalPages && (
              <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 sm:px-6">
                <div className="hidden h-10 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-2 sm:block">
                  <div className="h-1 w-full rounded bg-gray-200" />
                  <div className="mt-1 h-1 w-2/3 rounded bg-gray-200" />
                  <div className="mt-1 h-1 w-1/2 rounded bg-blue-500" />
                </div>
                <button
                  onClick={() => updateFilter('page', (filters.page || 1) + 1)}
                  className="text-left"
                >
                  <p className="text-sm font-medium text-gray-700 hover:text-blue-600">
                    Load more results...
                  </p>
                  <p className="text-xs text-gray-500">
                    {Math.max(0, total - filters.page * filters.page_size).toLocaleString()} items remaining in current filter set
                  </p>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Rows per page:</span>
                <select
                  value={filters.page_size}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, page_size: Number(e.target.value), page: 1 }))
                  }
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {[20, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={filters.page === 1}
                  onClick={() => updateFilter('page', (filters.page || 1) - 1)}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers.map((p, i) =>
                  p === '…' ? (
                    <span key={`gap-${i}`} className="px-2 text-sm text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => updateFilter('page', p)}
                      className={`min-w-[32px] rounded-md px-2 py-1 text-sm font-medium ${
                        filters.page === p
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  disabled={filters.page === totalPages}
                  onClick={() => updateFilter('page', (filters.page || 1) + 1)}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-gray-500">
                Page {filters.page} of {Math.max(1, totalPages)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Floating action button */}
      <button
        type="button"
        onClick={() => navigate('/tenders/new')}
        title="Create tender"
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function TendersPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <TendersPageContent />
    </Suspense>
  );
}
