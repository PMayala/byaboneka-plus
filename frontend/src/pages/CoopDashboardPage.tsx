import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, CheckCircle, Clock, TrendingUp,
  ChevronRight, Plus, Building2
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import api from '../services/api';
import { CATEGORY_INFO, STATUS_INFO } from '../types';
import { formatDateShort } from '../utils/dateUtils';

interface CoopDashboardData {
  cooperative: {
    id: number;
    name: string;
    registration_number: string;
    status: string;
    contact_info: string;
  };
  stats: {
    total: number;
    unclaimed: number;
    matched: number;
    returned: number;
  };
  recent_items: any[];
}

const CoopDashboardPage: React.FC = () => {
  const [data, setData] = useState<CoopDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/cooperative/dashboard');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-12">
          <EmptyState
            icon={<Building2 className="w-16 h-16" />}
            title="Not Assigned to Cooperative"
            description="You are not assigned to any cooperative. Please contact an administrator."
          />
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Items', value: data.stats.total, icon: Package, color: 'text-blue-500', bg: 'bg-blue-100' },
    { label: 'Unclaimed', value: data.stats.unclaimed, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100' },
    { label: 'Matched', value: data.stats.matched, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-100' },
    { label: 'Returned', value: data.stats.returned, icon: CheckCircle, color: 'text-trust-500', bg: 'bg-trust-100' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.cooperative.name}</h1>
            <p className="text-gray-500">Reg: {data.cooperative.registration_number}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link to="/report-found">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Register Found Item
            </Button>
          </Link>
          <Link to="/my-items?tab=found">
            <Button variant="secondary">
              <Package className="w-4 h-4 mr-2" />
              View All Items
            </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Items */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Found Items</h2>
          <Link to="/my-items?tab=found" className="text-sm text-primary-500 hover:text-primary-600 flex items-center">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {data.recent_items.length === 0 ? (
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title="No items yet"
            description="Register found items from drivers to start"
            action={
              <Link to="/report-found">
                <Button size="sm">Register Item</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {data.recent_items.map((item) => (
              <Link key={item.id} to={`/found-items/${item.id}`}>
                <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">{CATEGORY_INFO[item.category as keyof typeof CATEGORY_INFO]?.icon || '📦'}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">
                        {item.location_area} • {formatDateShort(item.found_date)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    item.status === 'RETURNED' ? 'verified' :
                    item.status === 'MATCHED' ? 'active' : 'pending'
                  }>
                    {STATUS_INFO[item.status]?.label || item.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CoopDashboardPage;
