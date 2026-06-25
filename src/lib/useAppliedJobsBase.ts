import { useLocation } from 'react-router-dom';

/** Base path for Applied Job System routes (`/dashboard/applied-jobs` or `/admin/applied-jobs`). */
export function useAppliedJobsBase(): string {
  const { pathname } = useLocation();
  return pathname.startsWith('/admin/') ? '/admin/applied-jobs' : '/dashboard/applied-jobs';
}
