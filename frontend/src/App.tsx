import { useEffect, useState } from 'react';
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getMe, logout } from './lib/api/auth';
import { ApiError } from './lib/api/client';
import { LoginPage } from './features/auth/LoginPage';
import { useAuthUiStore } from './features/auth/authStore';
import { roleHomePath } from './features/auth/routing';
import { queryClient } from './lib/queryClient';
import { ErrorMessage, LoadingMessage } from './components/Feedback';
import type { AuthenticatedUser } from './types/auth';
import './styles/global.css';

function ProtectedLayout({ allowed }: { allowed: AuthenticatedUser['role'][] }) {
  const location = useLocation();
  const sessionVersion = useAuthUiStore((state) => state.sessionVersion);
  const session = useQuery({ queryKey: ['auth', 'me', sessionVersion], queryFn: ({ signal }) => getMe(signal) });
  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
  }, [session.error]);
  if (session.isPending) return <LoadingMessage />;
  if (session.error instanceof ApiError && session.error.status === 401) return <Navigate to="/login" replace state={{ returnTo: location.pathname + location.search + location.hash }} />;
  if (session.error instanceof ApiError && session.error.status === 403) return <ErrorMessage>Access to this account is not permitted.</ErrorMessage>;
  if (session.error) return <ErrorMessage>Connection failed. Refresh to try again.</ErrorMessage>;
  const user = session.data;
  if (!user || !user.role) return <ErrorMessage>We could not identify this account's role. Contact your event administrator.</ErrorMessage>;
  if (!allowed.includes(user.role)) return <Navigate to={roleHomePath(user.role)} replace />;
  return <div className="role-page"><header><strong>TECH TOMBOLA</strong><span>{user.name}</span><LogoutButton /></header><main><p>{user.role === 'PARTICIPANT' ? 'Your event ticket is ready.' : user.role === 'SUPER_ADMIN' ? 'Super Admin access.' : 'Admin access.'}</p></main><Outlet /></div>;
}

function LoginRoute() {
  const sessionVersion = useAuthUiStore((state) => state.sessionVersion);
  const session = useQuery({ queryKey: ['auth', 'me', sessionVersion], queryFn: ({ signal }) => getMe(signal) });
  if (session.isPending) return <LoadingMessage />;
  if (session.data) return <Navigate to={roleHomePath(session.data.role)} replace />;
  if (session.error instanceof ApiError && session.error.status === 403) return <ErrorMessage>Access to this account is not permitted.</ErrorMessage>;
  if (session.error instanceof Error && session.error.name === 'ZodError') return <ErrorMessage>We could not identify this account's role. Contact your event administrator.</ErrorMessage>;
  if (session.error && !(session.error instanceof ApiError && session.error.status === 401)) return <ErrorMessage>Connection failed. Refresh to try again.</ErrorMessage>;
  return <LoginPage />;
}

function LogoutButton() {
  const navigate = useNavigate();
  const identityChanged = useAuthUiStore((state) => state.identityChanged);
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    setError('');
    try {
      await logout();
      queryClient.clear();
      identityChanged();
      navigate('/login', { replace: true });
    } catch {
      setError('We could not end your session. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }
  return <><button onClick={signOut} disabled={pending}>{pending ? 'Signing out…' : 'Sign out'}</button>{error && <span role="alert">{error}</span>}</>;
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedLayout allowed={['PARTICIPANT']} />}><Route path="/participant/*" element={<div />} /></Route>
    <Route element={<ProtectedLayout allowed={['ADMIN', 'SUPER_ADMIN']} />}><Route path="/admin/*" element={<div />} /></Route>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes /></BrowserRouter></QueryClientProvider>;
}
