import { Navigate, useLocation, useParams } from 'react-router-dom';

export function LegacyJobInterviewRedirect() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/admin') ? '/admin' : '/dashboard';
  const target = id ? `${prefix}/applied-jobs/interviews/${id}` : `${prefix}/applied-jobs/interviews`;
  return <Navigate to={target} replace />;
}
