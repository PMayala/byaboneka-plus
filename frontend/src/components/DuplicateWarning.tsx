import React from 'react';

/**
 * DuplicateWarning Component for Byaboneka+
 * 
 * Implements SYS-05: Duplicate detection warning
 * Shows users potential duplicate items before they create a new report
 */

interface DuplicateCandidate {
  id: number;
  type: 'lost' | 'found';
  title: string;
  description: string;
  category: string;
  location_area: string;
  date: string;
  similarity_score: number;
  similarity_reasons: string[];
}

interface DuplicateWarningProps {
  candidates: DuplicateCandidate[];
  itemType: 'lost' | 'found';
  onContinue: () => void;
  onViewDuplicate: (id: number, type: 'lost' | 'found') => void;
  onCancel: () => void;
}

export const DuplicateWarning: React.FC<DuplicateWarningProps> = ({
  candidates,
  itemType,
  onContinue,
  onViewDuplicate,
  onCancel
}) => {
  if (candidates.length === 0) return null;

  const highestScore = Math.max(...candidates.map(c => c.similarity_score));
  const isHighProbability = highestScore >= 12;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 ${isHighProbability ? 'bg-orange-50' : 'bg-yellow-50'} border-b`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isHighProbability ? 'bg-orange-100' : 'bg-yellow-100'}`}>
              <svg 
                className={`w-6 h-6 ${isHighProbability ? 'text-orange-600' : 'text-yellow-600'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isHighProbability ? 'text-orange-900' : 'text-yellow-900'}`}>
                {isHighProbability 
                  ? 'Possible Duplicate Detected' 
                  : 'Similar Items Found'}
              </h3>
              <p className={`text-sm mt-1 ${isHighProbability ? 'text-orange-700' : 'text-yellow-700'}`}>
                {itemType === 'lost' 
                  ? 'We found similar reports that might be yours. Please check before creating a new one.'
                  : 'We found similar items already reported. Please verify this is not a duplicate.'}
              </p>
            </div>
          </div>
        </div>

        {/* Candidate List */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-4">
            Found {candidates.length} similar {itemType === 'lost' ? 'report(s)' : 'item(s)'}:
          </p>

          <div className="space-y-4">
            {candidates.map((candidate) => (
              <div 
                key={`${candidate.type}-${candidate.id}`}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{candidate.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    candidate.similarity_score >= 12 
                      ? 'bg-orange-100 text-orange-700' 
                      : candidate.similarity_score >= 10 
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {candidate.similarity_score >= 12 ? 'High match' : 
                     candidate.similarity_score >= 10 ? 'Medium match' : 'Low match'}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {candidate.description}
                </p>
                
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {candidate.location_area}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(candidate.date).toLocaleDateString()}
                  </span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded">
                    {candidate.category}
                  </span>
                </div>

                {/* Match Reasons */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {candidate.similarity_reasons.slice(0, 3).map((reason, idx) => (
                    <span 
                      key={idx}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onViewDuplicate(candidate.id, candidate.type)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  View details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {isHighProbability 
              ? 'We recommend checking the similar items before proceeding.'
              : 'You can still create your report if none of these match.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${
                isHighProbability 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isHighProbability ? 'Continue Anyway' : 'Create New Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateWarning;
