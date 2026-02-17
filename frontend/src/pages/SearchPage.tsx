import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, Filter, MapPin, Calendar, Smartphone, CreditCard, 
  Wallet, Briefcase, Key, Package, X, RefreshCw
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import { foundItemsApi, lostItemsApi } from '../services/api';
import { FoundItem, LostItem, ItemCategory, CATEGORY_INFO, RWANDA_LOCATIONS } from '../types';
import { format, isValid, parseISO } from 'date-fns';

// Safe date formatter
const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return 'N/A';
    return format(date, 'MMM d');
  } catch {
    return 'N/A';
  }
};

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'found' | 'lost'>(
    (searchParams.get('type') as 'found' | 'lost') || 'found'
  );
  const [items, setItems] = useState<(FoundItem | LostItem)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Filter states
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    category: searchParams.get('category') || '',
    location_area: searchParams.get('location') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
  });

  useEffect(() => {
    loadItems();
  }, [activeTab, searchParams]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.category) params.category = filters.category;
      if (filters.location_area) params.location_area = filters.location_area;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      params.page = searchParams.get('page') || '1';
      params.limit = '12';

      const response = activeTab === 'found'
        ? await foundItemsApi.getAll(params)
        : await lostItemsApi.getAll(params);

      setItems(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (err: any) {
      console.error('Failed to load items:', err);
      setError('Failed to load items. Please try again.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('type', activeTab);
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.category) params.set('category', filters.category);
    if (filters.location_area) params.set('location', filters.location_area);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    setSearchParams(params);
  };

  const handleTabChange = (tab: 'found' | 'lost') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('type', tab);
    params.delete('page');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({
      keyword: '',
      category: '',
      location_area: '',
      date_from: '',
      date_to: '',
    });
    setSearchParams({ type: activeTab });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = filters.keyword || filters.category || filters.location_area || filters.date_from || filters.date_to;

  const getItemDate = (item: FoundItem | LostItem): string => {
    if (activeTab === 'found') {
      return (item as FoundItem).found_date || '';
    }
    return (item as LostItem).lost_date || '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Search Items</h1>
        <p className="text-gray-600">Find lost or found items reported in Rwanda</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => handleTabChange('found')}
          className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'found'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Found Items
        </button>
        <button
          onClick={() => handleTabChange('lost')}
          className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'lost'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Lost Items
        </button>
      </div>

      {/* Search Bar */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                placeholder="Search by keyword..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 sm:flex-none">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full" />
                )}
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select
                  value={filters.location_area}
                  onChange={(e) => setFilters({ ...filters, location_area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Locations</option>
                  {RWANDA_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {hasActiveFilters && (
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </form>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadItems}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="w-16 h-16" />}
          title="No items found"
          description={hasActiveFilters 
            ? "Try adjusting your filters or search terms" 
            : `No ${activeTab} items have been reported yet`
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Link to={activeTab === 'found' ? '/report-found' : '/report-lost'}>
                <Button>Report an Item</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">
              Showing <span className="font-medium">{items.length}</span> of{' '}
              <span className="font-medium">{pagination.total}</span> items
            </p>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/${activeTab === 'found' ? 'found' : 'lost'}-items/${item.id}`}
                className="block"
              >
                <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                  {/* Image */}
                  <div className="aspect-video bg-gray-100 relative">
                    {activeTab === 'found' && (item as FoundItem).image_urls && (item as FoundItem).image_urls.length > 0 ? (
                      <img
                        src={(item as FoundItem).image_urls[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl">
                          {CATEGORY_INFO[item.category as ItemCategory]?.icon || '📦'}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge variant={activeTab === 'found' ? 'verified' : 'pending'}>
                        {activeTab === 'found' ? 'Found' : 'Lost'}
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1 flex-1">
                        {item.title}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                        CATEGORY_INFO[item.category as ItemCategory]?.color || 'bg-gray-100 text-gray-800'
                      }`}>
                        {CATEGORY_INFO[item.category as ItemCategory]?.label || item.category}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{item.location_area}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        {formatDateShort(getItemDate(item))}
                      </span>
                    </div>

                    {activeTab === 'found' && (item as FoundItem).source === 'COOPERATIVE' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs text-trust-600 font-medium">
                          🚌 Held at cooperative
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      pagination.page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;