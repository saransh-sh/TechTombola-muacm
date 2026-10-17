import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ApiError } from '../../lib/api/client';
import { getCurrentRound, getParticipantEvent } from '../../lib/api/participant';
import { getParticipantTicket } from '../../lib/api/ticket';
import { useAuthUiStore } from '../auth/authStore';
import type { AuthenticatedUser } from '../../types/auth';
import type { ParticipantTicket as Ticket } from '../../types/ticket';
import styles from './ParticipantTicket.module.css';

const refreshableRound = new Set(['DRAFT', 'READY', 'RECOVERY_REQUIRED']);

export function TicketGrid({ ticket, revealedKey, animateReveal = false }: { ticket: Ticket; revealedKey?: string; animateReveal?: boolean }) {
  const matchRef = useRef<HTMLTableCellElement>(null);
  const cells = new Map(ticket.cells.map((cell) => [`${cell.rowIndex}:${cell.colIndex}`, cell]));
  useEffect(() => {
    if (!animateReveal || !revealedKey || !matchRef.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const tween = gsap.fromTo(matchRef.current, { y: 4 }, { y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform' });
    return () => { tween.kill(); };
  }, [animateReveal, revealedKey]);
  return <table className={styles.grid} aria-label="Your Tombola ticket">
    <tbody>{Array.from({ length: 3 }, (_, row) => <tr key={row}>
      {Array.from({ length: 9 }, (_, column) => {
        const cell = cells.get(`${row}:${column}`);
        const matched = !!cell && cell.keyValue === revealedKey;
        return <td key={column} ref={matched ? matchRef : undefined} aria-label={cell ? `Row ${row + 1}, column ${column + 1}: ${cell.keyValue}, ${cell.marked ? 'marked' : 'not marked'}${matched ? ', matches latest revealed key' : ''}` : `Row ${row + 1}, column ${column + 1}: empty`} className={`${cell ? cell.marked ? styles.marked : styles.playable : styles.empty}${matched ? ` ${styles.matched}` : ''}`} data-cell-id={cell?.id} data-marked={cell?.marked ?? undefined}>
          {cell ? <><span className={styles.position}>R{row + 1} · C{column + 1}</span><strong>{cell.keyValue}</strong><span className={styles.cellState}>{cell.marked ? 'Marked' : 'Not marked'}</span><span className={styles.statusIcon} aria-hidden="true">{cell.marked ? '✓' : '○'}</span></> : <span className={styles.emptyLabel}>Empty</span>}
        </td>;
      })}
    </tr>)}</tbody>
  </table>;
}

export function ParticipantTicket({ revealedKey, animateReveal = false }: { revealedKey?: string; animateReveal?: boolean } = {}) {
  const user = useOutletContext<AuthenticatedUser>();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const identityChanged = useAuthUiStore((state) => state.identityChanged);
  const event = useQuery({ queryKey: ['participant', user.id, 'event'], queryFn: ({ signal }) => getParticipantEvent(signal), refetchOnReconnect: 'always' });
  const round = useQuery({
    queryKey: ['participant', user.id, 'round', event.data?.id], queryFn: ({ signal }) => getCurrentRound(signal), enabled: !!event.data,
    refetchOnReconnect: 'always',
    refetchInterval: (query) => {
      if (query.state.error) return query.state.error instanceof ApiError && query.state.error.status === 404 ? 5000 : false;
      return query.state.data && refreshableRound.has(query.state.data.status) ? 5000 : false;
    },
  });
  const ticket = useQuery({
    queryKey: ['participant', user.id, 'ticket', event.data?.id, round.data?.id],
    queryFn: ({ signal }) => getParticipantTicket(round.data!.id, event.data!.id, signal), enabled: !!event.data && !!round.data,
    refetchOnReconnect: 'always',
    refetchInterval: (query) => query.state.error instanceof ApiError && query.state.error.status === 404 ? 5000 : false,
  });
  useEffect(() => {
    if ([event.error, round.error, ticket.error].some((error) => error instanceof ApiError && error.status === 401)) {
      queryClient.clear();
      identityChanged();
      navigate('/login', { replace: true, state: { returnTo: location.pathname + location.search + location.hash } });
    }
  }, [event.error, identityChanged, location.hash, location.pathname, location.search, navigate, queryClient, round.error, ticket.error]);

  const noEvent = event.error instanceof ApiError && event.error.status === 404;
  const noRound = round.error instanceof ApiError && round.error.status === 404;
  const noTicket = ticket.error instanceof ApiError && ticket.error.status === 404;
  const eventForbidden = event.error instanceof ApiError && event.error.status === 403;
  const roundForbidden = round.error instanceof ApiError && round.error.status === 403;
  const ticketForbidden = ticket.error instanceof ApiError && ticket.error.status === 403;
  const showEvent = !!event.data && !noEvent && !eventForbidden;
  const showRound = !!round.data && !noRound && !roundForbidden;
  const showTicket = !!ticket.data && !noTicket && !ticketForbidden;
  const retry = () => void (ticket.error ? ticket.refetch() : round.error ? round.refetch() : event.refetch());

  return <main className={styles.page}>
    <header className={styles.intro}>
      <Link className={styles.back} to="/participant/lobby">← Lobby</Link>
      <p className={styles.kicker}>YOUR TICKET</p>
      <h1>Find the key.<br /><em>Mark the cell.</em></h1>
      <p>When the host reveals a key, find the matching cell on this ticket. The host’s server holds your ticket and marked cells.</p>
    </header>
    {event.isPending ? <p className={styles.notice} role="status">Loading your event…</p> : noEvent ? <section className={styles.notice}><h2>No event assigned yet</h2><p>Your event administrator will connect your account to an event.</p></section> : event.error && (!event.data || eventForbidden) ? <TicketError error={event.error} retry={retry} /> : null}
    {showEvent && <>
      {round.isPending ? <p className={styles.notice} role="status">Checking for your current round…</p> : noRound ? <section className={styles.notice}><h2>No current round</h2><p>Your host has not made a round available yet. This page will update when one is ready.</p></section> : round.error && (!round.data || roundForbidden) ? <TicketError error={round.error} retry={retry} /> : null}
      {showRound && <>
        <div className={styles.roundHeading}><span>{event.data.title}</span><h2>{round.data.name}</h2><span className={styles.roundStatus}>{round.data.status.replaceAll('_', ' ')}</span></div>
        {ticket.isPending ? <p className={styles.notice} role="status">Loading your ticket…</p> : noTicket ? <section className={styles.notice}><h2>Your ticket is being prepared</h2><p>This round is available, but its ticket has not arrived yet. This page will update when the host finishes preparing tickets.</p></section> : ticket.error && (!ticket.data || ticketForbidden) ? <TicketError error={ticket.error} retry={retry} /> : null}
        {showTicket && <section className={styles.ticket} aria-label="Ticket details">
          <div className={styles.ticketHead}><div><span className={styles.label}>TICKET</span><h3>{ticket.data.id}</h3></div><span className={styles.serverMark}>MARKS SAVED BY SERVER</span></div>
          <TicketGrid ticket={ticket.data} revealedKey={revealedKey} animateReveal={animateReveal} />
          {(ticket.error || event.error || round.error) && <p className={styles.stale} role="status">Could not refresh current details. Showing the last ticket received from the server.</p>}
        </section>}
      </>}
    </>}
  </main>;
}

function TicketError({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof ApiError && error.status === 403 ? 'You do not have permission to view this ticket.' : 'We could not load your ticket data. Check your connection and try again.';
  return <section className={styles.notice}><h2>Ticket unavailable</h2><p role="alert">{message}</p>{!(error instanceof ApiError && error.status === 403) && <button onClick={retry}>Retry</button>}</section>;
}
