import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import type { ParticipantRound } from '../../types/participant';
import { patternNames } from './useParticipantClaims';
import { useLiveWinners, useParticipantWins } from './useParticipantWins';
import styles from './WinnerBanner.module.css';

export function WinnerBanner({ userId, roundId, roundStatus }: { userId: string; roundId: string; roundStatus: ParticipantRound['status'] }) {
  const own = useParticipantWins(userId);
  const live = useLiveWinners();
  const bannerRef = useRef<HTMLElement>(null);
  const ownWins = own.data?.data.filter((winner) => winner.roundId === roundId) ?? [];
  const others = live.data?.roundId === roundId && !Array.isArray(live.data.data)
    ? Object.values(live.data.data).flat()
    : [];
  const ownIds = ownWins.map((winner) => winner.id).join(',');

  useEffect(() => {
    if (!ownIds || roundStatus === 'COMPLETED' || roundStatus === 'CANCELLED' || !bannerRef.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const tween = gsap.fromTo(bannerRef.current, { scale: 0.98 }, { scale: 1, duration: 0.3, ease: 'power2.out', clearProps: 'transform' });
    return () => { tween.kill(); };
  }, [ownIds, roundStatus]);

  if (own.isPending && live.isPending) return null;
  if (ownWins.length === 0 && others.length === 0) return null;
  return <section ref={bannerRef} className={styles.banner} aria-label="Verified winners" aria-live="polite">
    {ownWins.length > 0 && <><h2>Your win is verified</h2>{ownWins.map((winner) => <p key={winner.id}>The host verified your <strong>{patternNames[winner.patternType]}</strong> claim.</p>)}</>}
    {others.length > 0 && <div className={styles.others}><strong>Verified winners this round</strong><ul>{others.map((winner) => <li key={winner.id}>{winner.participantName} · {patternNames[winner.pattern]}</li>)}</ul></div>}
    <Link to="/participant/results">View results</Link>
  </section>;
}
