import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import type { AuthenticatedUser } from '../../types/auth';
import styles from './AdminLayout.module.css';

const links = [
  ['Dashboard', '/admin'],
  ['Event', '/admin/events'],
  ['Rounds', '/admin/rounds'],
  ['Questions & Keys', '/admin/questions'],
  ['Participants', '/admin/participants'],
  ['Draw control', '/admin/draw-control'],
  ['Claims', '/admin/claims'],
  ['Winners', '/admin/winners'],
  ['Audit', '/admin/audit'],
] as const;

const sections: Record<string, string> = {
  events: 'Event management', rounds: 'Round configuration', questions: 'Questions and Keys',
  participants: 'Participant management', administrators: 'Administrator accounts', 'draw-control': 'Draw control', claims: 'Claim review',
  winners: 'Winner history', audit: 'Audit log', system: 'System health and recovery',
};

export function AdminLayout() {
  const user = useOutletContext<AuthenticatedUser>();
  const navigation = user.role === 'SUPER_ADMIN' ? [...links, ['Administrators', '/admin/administrators'] as const, ['System', '/admin/system'] as const] : links;
  return <div className={styles.layout}>
    <aside className={styles.nav} aria-label="Admin navigation">
      <p className={styles.brand}>EVENT OPERATIONS</p>
      <nav><ul className={styles.navList}>{navigation.map(([label, path]) => <li key={path}><NavLink end={path === '/admin'} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`} to={path}>{label}</NavLink></li>)}</ul></nav>
    </aside>
    <div className={styles.content}><Outlet context={user} /></div>
  </div>;
}

export function AdminSectionPlaceholder() {
  const user = useOutletContext<AuthenticatedUser>();
  const location = useLocation();
  const section = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
  const title = sections[section] ?? 'Admin workspace';
  return <section className={styles.placeholder} aria-labelledby="admin-section-title">
    <p className={styles.brand}>{user.role === 'SUPER_ADMIN' ? 'SUPER ADMIN WORKSPACE' : 'ADMIN WORKSPACE'}</p>
    <h1 id="admin-section-title">{title}</h1>
    <p>This operational screen is not available in this implementation slice.</p>
    <NavLink to="/admin">Return to dashboard</NavLink>
  </section>;
}
