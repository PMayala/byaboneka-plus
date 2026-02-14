import React, { useState, useEffect } from 'react';
import { handoverLocationsApi } from '../services/novelFeatureApi';

// ============================================
// TYPES
// ============================================

interface SafeHandoverPoint {
  id: number;
  name: string;
  type: 'COOPERATIVE_OFFICE' | 'SECTOR_OFFICE' | 'POLICE_POST' | 'TRANSIT_HUB';
  address: string;
  area: string;
  operating_hours: string;
  safety_rating: number;
}

interface Props {
  itemArea: string;
  itemCategory: string;
  onSelectLocation?: (location: SafeHandoverPoint) => void;
}

// ============================================
// COMPONENT
// ============================================

const SafeHandoverLocationPicker: React.FC<Props> = ({
  itemArea, itemCategory, onSelectLocation
}) => {
  const [locations, setLocations] = useState<SafeHandoverPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [itemArea, itemCategory]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const res = await handoverLocationsApi.getRecommended(itemArea, itemCategory);
      setLocations(res.data?.data || []);
    } catch {
      // Fallback to all locations
      try {
        const res = await handoverLocationsApi.getAllLocations();
        setLocations(res.data?.data?.slice(0, 5) || []);
      } catch {
        setLocations([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const typeIcons: Record<string, string> = {
    'COOPERATIVE_OFFICE': '🏢',
    'SECTOR_OFFICE': '🏛️',
    'POLICE_POST': '👮',
    'TRANSIT_HUB': '🚌',
  };

  const typeLabels: Record<string, string> = {
    'COOPERATIVE_OFFICE': 'Cooperative Office',
    'SECTOR_OFFICE': 'Sector Office',
    'POLICE_POST': 'Police Post',
    'TRANSIT_HUB': 'Transit Hub',
  };

  const typeColors: Record<string, string> = {
    'COOPERATIVE_OFFICE': '#1E3A5F',
    'SECTOR_OFFICE': '#2E7D32',
    'POLICE_POST': '#4A148C',
    'TRANSIT_HUB': '#E65100',
  };

  const handleSelect = (loc: SafeHandoverPoint) => {
    setSelectedId(loc.id);
    onSelectLocation?.(loc);
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
        Loading safe meeting points...
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', background: '#F0F7FF',
        borderBottom: '1px solid #DBEAFE'
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1E3A5F', marginBottom: 4 }}>
          📍 Recommended Safe Meeting Points
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {['ID', 'WALLET', 'PHONE'].includes(itemCategory)
            ? '⚠️ For sensitive items, cooperative offices and sector offices are strongly recommended.'
            : 'Choose a well-lit public location during business hours.'}
        </div>
      </div>

      {/* Location list */}
      {locations.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          No locations found for this area. You can arrange a meeting at any cooperative office.
        </div>
      ) : (
        <div>
          {locations.map((loc, i) => (
            <div
              key={loc.id}
              onClick={() => handleSelect(loc)}
              style={{
                padding: '12px 16px',
                borderBottom: i < locations.length - 1 ? '1px solid #F3F4F6' : 'none',
                cursor: 'pointer',
                background: selectedId === loc.id ? '#EFF6FF' : 'white',
                transition: 'background 0.15s',
                display: 'flex', alignItems: 'flex-start', gap: 12
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>
                {typeIcons[loc.type] || '📍'}
              </span>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1F2937' }}>
                    {loc.name}
                  </span>
                  {i === 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px',
                      borderRadius: 8, background: '#D1FAE5', color: '#065F46'
                    }}>
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                  {loc.address}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9CA3AF' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 6,
                    background: `${typeColors[loc.type]}15`,
                    color: typeColors[loc.type],
                    fontWeight: 500
                  }}>
                    {typeLabels[loc.type]}
                  </span>
                  <span>🕐 {loc.operating_hours}</span>
                  <span>
                    {'⭐'.repeat(Math.min(loc.safety_rating, 5))}
                  </span>
                </div>
              </div>

              {/* Selection indicator */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selectedId === loc.id ? '#1E3A5F' : '#D1D5DB'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 8
              }}>
                {selectedId === loc.id && (
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#1E3A5F'
                  }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Safety reminder */}
      <div style={{
        padding: '10px 16px', background: '#FFFBEB',
        borderTop: '1px solid #FDE68A', fontSize: 12, color: '#92400E'
      }}>
        🛡️ Never share your OTP code until you physically receive your item at the meeting location.
      </div>
    </div>
  );
};

export default SafeHandoverLocationPicker;