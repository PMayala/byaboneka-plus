import { format, isValid, parseISO } from 'date-fns';

/**
 * Safe date formatting that handles invalid dates gracefully
 */
export const formatDate = (dateString: string | null | undefined, formatStr: string = 'MMM d, yyyy'): string => {
  if (!dateString) return 'Unknown';
  try {
    // Try parsing as ISO string first
    let date = parseISO(dateString);
    
    // If that fails, try creating a new Date
    if (!isValid(date)) {
      date = new Date(dateString);
    }
    
    if (!isValid(date)) return 'Unknown';
    return format(date, formatStr);
  } catch {
    return 'Unknown';
  }
};

export const formatDateShort = (dateString: string | null | undefined): string => {
  return formatDate(dateString, 'MMM d');
};

export const formatDateLong = (dateString: string | null | undefined): string => {
  return formatDate(dateString, 'MMMM d, yyyy');
};

export const formatDateTime = (dateString: string | null | undefined): string => {
  return formatDate(dateString, 'MMM d, yyyy h:mm a');
};

export const formatRelative = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown';
  try {
    let date = parseISO(dateString);
    if (!isValid(date)) {
      date = new Date(dateString);
    }
    if (!isValid(date)) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return format(date, 'MMM d');
  } catch {
    return 'Unknown';
  }
};