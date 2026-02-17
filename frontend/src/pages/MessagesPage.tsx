import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronRight, Inbox } from 'lucide-react';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/ui';
import { messagesApi } from '../services/api';
import { MessageThread, STATUS_INFO } from '../types';
import { formatRelative } from '../utils/dateUtils';

const MessagesPage: React.FC = () => {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      const response = await messagesApi.getThreads();
      setThreads(response.data.data || []);
    } catch (error) {
      console.error('Failed to load threads:', error);
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
        <p className="text-gray-600">Communicate with finders and owners about claims</p>
      </div>

      {threads.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<Inbox className="w-16 h-16" />}
            title="No messages yet"
            description="When you create or receive claims, you can message the other party here"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Link key={thread.claim_id} to={`/claims/${thread.claim_id}`}>
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-6 h-6 text-primary-600" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {thread.item_title}
                        </h3>
                        {thread.unread_count > 0 && (
                          <span className="px-2 py-0.5 bg-accent-500 text-white text-xs font-medium rounded-full">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={
                          thread.claim_status === 'VERIFIED' ? 'verified' :
                          thread.claim_status === 'PENDING' ? 'pending' : 'expired'
                        }>
                          {STATUS_INFO[thread.claim_status]?.label || thread.claim_status}
                        </Badge>
                        <span className="text-gray-500">
                          {thread.my_role === 'owner' ? 'You are the owner' : 'You found this'}
                        </span>
                      </div>

                      {thread.last_message && (
                        <p className="text-sm text-gray-600 truncate mt-2">
                          {thread.last_message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    {thread.last_message_at && (
                      <span className="text-xs text-gray-500">
                        {formatRelative(thread.last_message_at)}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;