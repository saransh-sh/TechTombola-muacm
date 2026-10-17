import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../lib/api/client';
import { getAdminEvent } from '../../lib/api/adminEvents';
import { getAdminRound, listAdminRounds } from '../../lib/api/adminRounds';
import { createAdminKey, createAdminQuestion, deleteAdminQuestion, listAdminKeys, listAdminQuestions, updateAdminKey, updateAdminQuestion } from '../../lib/api/adminQuestions';
import type { AuthenticatedUser } from '../../types/auth';
import styles from './AdminQuestions.module.css';

const PAGE_SIZE = 20;
const eventKey = (userId: string, eventId: string) => ['admin-events', userId, 'detail', eventId] as const;
const roundsKey = (userId: string, eventId: string) => ['admin-rounds', userId, eventId, 'list', 1] as const;
const roundKey = (userId: string, eventId: string, roundId: string) => ['admin-rounds', userId, eventId, 'detail', roundId] as const;
const keysKey = (userId: string, eventId: string, page: number) => ['admin-keys', userId, eventId, page] as const;
const questionsKey = (userId: string, eventId: string, roundId: string, page: number) => ['admin-questions', userId, eventId, roundId, page] as const;

function messageFor(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }

export function AdminQuestions() {
  const user = useOutletContext<AuthenticatedUser>();
  const [params, setParams] = useSearchParams();
  const eventId = params.get('eventId') ?? '';
  const roundId = params.get('roundId') ?? '';
  const keyPage = Math.max(1, Number(params.get('keyPage')) || 1);
  const questionPage = Math.max(1, Number(params.get('questionPage')) || 1);
  const queryClient = useQueryClient();
  const [keyForm, setKeyForm] = useState('');
  const [keyFormEventId, setKeyFormEventId] = useState('');
  const [questionForm, setQuestionForm] = useState({ keyId: '', questionText: '' });
  const [creatingKey, setCreatingKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [message, setMessage] = useState('');

  const event = useQuery({ queryKey: eventKey(user.id, eventId), queryFn: ({ signal }) => getAdminEvent(eventId, signal), enabled: Boolean(eventId) });
  const rounds = useQuery({ queryKey: roundsKey(user.id, eventId), queryFn: ({ signal }) => listAdminRounds({ eventId, page: 1, limit: 100, signal }), enabled: Boolean(eventId) });
  const round = useQuery({ queryKey: roundKey(user.id, eventId, roundId), queryFn: ({ signal }) => getAdminRound(roundId, signal), enabled: Boolean(eventId && roundId) });
  const keys = useQuery({ queryKey: keysKey(user.id, eventId, keyPage), queryFn: ({ signal }) => listAdminKeys({ eventId, page: keyPage, limit: PAGE_SIZE, signal }), enabled: Boolean(eventId) });
  const questions = useQuery({ queryKey: questionsKey(user.id, eventId, roundId, questionPage), queryFn: ({ signal }) => listAdminQuestions({ roundId, page: questionPage, limit: PAGE_SIZE, signal }), enabled: Boolean(eventId && roundId && round.data?.eventId === eventId) });

  useEffect(() => {
    setSelectedKeyId(''); setCreatingKey(false); setEditingKey(false); setKeyForm(''); setKeyFormEventId('');
  }, [eventId]);

  useEffect(() => {
    setSelectedQuestionId(''); setCreatingQuestion(false); setEditingQuestion(false);
    setQuestionForm({ keyId: '', questionText: '' }); setMessage('');
  }, [eventId, roundId]);

  const createKey = useMutation({
    mutationFn: (input: { eventId: string; value: string }) => createAdminKey(input),
    onSuccess: async (saved, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-keys', user.id, variables.eventId] });
      if (params.get('eventId') === variables.eventId) { setKeyForm(''); setCreatingKey(false); setMessage(`Key ${saved.value} saved.`); }
    },
    onError: async (error, variables) => { if (params.get('eventId') === variables.eventId) setMessage(messageFor(error, 'Could not create Key. The latest list was requested before retrying.')); await queryClient.invalidateQueries({ queryKey: ['admin-keys', user.id, variables.eventId] }); },
  });
  const editKey = useMutation({
    mutationFn: ({ id, value }: { eventId: string; id: string; value: string }) => updateAdminKey(id, { value }),
    onSuccess: async (_saved, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin-keys', user.id, variables.eventId] }); if (params.get('eventId') === variables.eventId) { setEditingKey(false); setMessage('Key changes saved.'); } },
    onError: async (error, variables) => { if (params.get('eventId') === variables.eventId) setMessage(messageFor(error, 'Could not update this Key. Refresh the list and review server feedback.')); await queryClient.invalidateQueries({ queryKey: ['admin-keys', user.id, variables.eventId] }); },
  });
  const createQuestion = useMutation({
    mutationFn: (input: { eventId: string; roundId: string; keyId: string; questionText: string }) => createAdminQuestion({ roundId: input.roundId, keyId: input.keyId, questionText: input.questionText }),
    onSuccess: async (saved, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin-questions', user.id, variables.eventId, variables.roundId] }); if (params.get('eventId') === variables.eventId && params.get('roundId') === saved.roundId) { setCreatingQuestion(false); setSelectedQuestionId(saved.id); setMessage('Question association saved.'); } },
    onError: async (error, variables) => { if (params.get('eventId') === variables.eventId && params.get('roundId') === variables.roundId) setMessage(messageFor(error, 'Could not associate this Question. Refresh the list before retrying.')); await queryClient.invalidateQueries({ queryKey: ['admin-questions', user.id, variables.eventId, variables.roundId] }); },
  });
  const editQuestion = useMutation({
    mutationFn: ({ id, questionText }: { eventId: string; roundId: string; id: string; questionText: string }) => updateAdminQuestion(id, { questionText }),
    onSuccess: async (_saved, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin-questions', user.id, variables.eventId, variables.roundId] }); if (params.get('eventId') === variables.eventId && params.get('roundId') === variables.roundId) { setEditingQuestion(false); setMessage('Question changes saved.'); } },
    onError: async (error, variables) => { if (params.get('eventId') === variables.eventId && params.get('roundId') === variables.roundId) setMessage(messageFor(error, 'Could not update this Question. Refresh the list and review server feedback.')); await queryClient.invalidateQueries({ queryKey: ['admin-questions', user.id, variables.eventId, variables.roundId] }); },
  });
  const removeQuestion = useMutation({
    mutationFn: ({ id }: { eventId: string; roundId: string; id: string }) => deleteAdminQuestion(id),
    onSuccess: async (_saved, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin-questions', user.id, variables.eventId, variables.roundId] }); if (params.get('eventId') === variables.eventId && params.get('roundId') === variables.roundId) { setSelectedQuestionId(''); setEditingQuestion(false); setMessage('Question removed.'); } },
    onError: async (error, variables) => { if (params.get('eventId') === variables.eventId && params.get('roundId') === variables.roundId) setMessage(messageFor(error, 'Could not remove this Question. Refresh the list and review server feedback.')); await queryClient.invalidateQueries({ queryKey: ['admin-questions', user.id, variables.eventId, variables.roundId] }); },
  });

  const pending = createKey.isPending || editKey.isPending || createQuestion.isPending || editQuestion.isPending || removeQuestion.isPending;
  const selectedRound = round.data?.eventId === eventId ? round.data : undefined;
  const questionsReadOnly = selectedRound ? selectedRound.status !== 'DRAFT' : true;
  const selectedQuestion = questions.data?.data.find((item) => item.id === selectedQuestionId);

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next);
  }
  function chooseRound(id: string) { updateParams({ roundId: id, questionPage: '1' }); setSelectedQuestionId(''); setCreatingQuestion(false); setEditingQuestion(false); setMessage(''); }
  function submitKey(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (keyFormEventId !== eventId) return; setMessage(''); if (editingKey && selectedKeyId) editKey.mutate({ eventId, id: selectedKeyId, value: keyForm }); else createKey.mutate({ eventId, value: keyForm }); }
  function submitQuestion(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setMessage(''); if (editingQuestion && selectedQuestionId) editQuestion.mutate({ eventId, roundId, id: selectedQuestionId, questionText: questionForm.questionText }); else createQuestion.mutate({ eventId, roundId, keyId: questionForm.keyId, questionText: questionForm.questionText }); }

  if (!eventId) return <main className={styles.page}><p className={styles.eyebrow}>OPERATIONS / CONFIGURATION</p><h1>Questions &amp; Keys</h1><p>Choose an Event before managing its Key pool or Round Questions.</p><Link className={styles.action} to={{ pathname: '/admin/event', search: params.toString() ? `?${params}` : '' }}>Select an Event</Link></main>;

  function statusError(error: unknown, noun: string) { return error instanceof ApiError && error.status === 403 ? `Your account cannot manage ${noun}.` : messageFor(error, `Could not load ${noun}.`); }
  return <main className={styles.page}>
    <p className={styles.eyebrow}>OPERATIONS / CONFIGURATION</p>
    <header className={styles.heading}><div><h1>Questions &amp; Keys</h1><p>{event.data ? `Event: ${event.data.title}` : 'Loading selected Event…'}</p></div></header>
    {event.error && <p className={styles.notice} role="alert">{statusError(event.error, 'this Event')} <button type="button" onClick={() => void event.refetch()}>Retry Event</button></p>}
    {message && <p className={styles.notice} role="status">{message}</p>}
    <p className={styles.pendingContract}>Dataset-wide search and authoritative used-state filters are pending the G02 contract decision.</p>
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="key-heading"><header className={styles.sectionHeading}><h2 id="key-heading">Event Key pool</h2><button type="button" disabled={pending} onClick={() => { setCreatingKey(true); setEditingKey(false); setKeyForm(''); setKeyFormEventId(eventId); }}>Create Key</button></header>
        {keys.isPending && <p role="status">Loading Keys…</p>}
        {keys.error && <div><p role="alert">{statusError(keys.error, 'Keys')}</p><button type="button" onClick={() => void keys.refetch()}>Retry Keys</button></div>}
        {keys.data?.data.length === 0 && <p>No Keys are configured for this Event.</p>}
        {keys.data && keys.data.data.length > 0 && <ul className={styles.list}>{keys.data.data.map((key) => <li key={key.id}><button type="button" aria-pressed={selectedKeyId === key.id} onClick={() => { setSelectedKeyId(key.id); setEditingKey(false); setCreatingKey(false); }}>{key.value}</button><button type="button" disabled={pending} onClick={() => { setSelectedKeyId(key.id); setKeyForm(key.value); setKeyFormEventId(eventId); setEditingKey(true); setCreatingKey(false); }}>Edit Key</button></li>)}</ul>}
        {keys.data && <nav className={styles.pagination} aria-label="Key pages"><button type="button" disabled={keyPage <= 1 || pending} onClick={() => updateParams({ keyPage: String(keyPage - 1) })}>Previous</button><span>Page {keys.data.pagination.page} of {keys.data.pagination.totalPages}</span><button type="button" disabled={keyPage >= keys.data.pagination.totalPages || pending} onClick={() => updateParams({ keyPage: String(keyPage + 1) })}>Next</button></nav>}
        {keyFormEventId === eventId && (creatingKey || editingKey) && <form className={styles.form} onSubmit={submitKey}><h3>{editingKey ? 'Edit Key' : 'Create a Key'}</h3><label>Key value<input minLength={2} maxLength={50} pattern="[A-Za-z0-9 -]+" required value={keyForm} disabled={pending} onChange={(e) => setKeyForm(e.target.value)} /></label><p>Use 2–50 letters, numbers, spaces, or hyphens. The server normalizes the saved Key.</p><div className={styles.actions}><button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save Key'}</button><button type="button" disabled={pending} onClick={() => { setCreatingKey(false); setEditingKey(false); setKeyFormEventId(''); }}>Cancel</button></div></form>}
      </section>
      <section className={styles.panel} aria-labelledby="question-heading"><header className={styles.sectionHeading}><div><h2 id="question-heading">Round Questions</h2><p>{selectedRound ? `Round ${selectedRound.sequenceNumber}: ${selectedRound.name} · ${selectedRound.status}` : 'Select a Round'}</p></div>{selectedRound && <button type="button" disabled={pending || questionsReadOnly} onClick={() => { setCreatingQuestion(true); setEditingQuestion(false); setSelectedQuestionId(''); setQuestionForm({ keyId: '', questionText: '' }); }}>Add Question</button>}</header>
        {!roundId && <p>Choose a Round from this Event to load its Questions.</p>}
        {rounds.isPending && <p role="status">Loading Rounds…</p>}
        {rounds.error && <div><p role="alert">{statusError(rounds.error, 'Rounds')}</p><button type="button" onClick={() => void rounds.refetch()}>Retry Rounds</button></div>}
        {rounds.data && rounds.data.data.length === 0 && <p>No Rounds are configured for this Event.</p>}
        {roundId && round.data && round.data.eventId !== eventId && <p role="status">The selected Round belongs to another Event. Choose a Round from this Event.</p>}
        {rounds.data && rounds.data.data.length > 0 && <label>Selected Round<select value={roundId} disabled={pending} onChange={(e) => chooseRound(e.target.value)}><option value="">Choose a Round</option>{rounds.data.data.map((item) => <option key={item.id} value={item.id}>{item.sequenceNumber}. {item.name} ({item.status})</option>)}</select></label>}
        {rounds.data && rounds.data.pagination.totalPages > 1 && <p>Showing the first 100 Rounds. <Link to={`/admin/rounds?eventId=${encodeURIComponent(eventId)}`}>Open Round configuration</Link> to choose from the full paginated list.</p>}
        {selectedRound && rounds.data && !rounds.data.data.some((item) => item.id === selectedRound.id) && <p>The selected Round is outside the first 100. <Link to={`/admin/rounds?eventId=${encodeURIComponent(eventId)}`}>Open Round configuration</Link> to choose it from the paginated list.</p>}
        {selectedRound && questionsReadOnly && <p className={styles.notice}>Question configuration is locked after the Round reaches READY.</p>}
        {roundId && questions.isPending && <p role="status">Loading Questions…</p>}
        {questions.error && <div><p role="alert">{statusError(questions.error, 'Questions')}</p><button type="button" onClick={() => void questions.refetch()}>Retry Questions</button></div>}
        {selectedRound && questions.data?.data.length === 0 && <p>No Questions are configured for this Round.</p>}
        {selectedRound && questions.data && questions.data.data.length > 0 && <ul className={styles.list}>{questions.data.data.map((question) => <li key={question.id}><button type="button" aria-pressed={selectedQuestionId === question.id} onClick={() => { setSelectedQuestionId(question.id); setCreatingQuestion(false); setEditingQuestion(false); }}>{question.keyValue}<span>{question.questionText}</span></button>{!questionsReadOnly && <><button type="button" disabled={pending} onClick={() => { setSelectedQuestionId(question.id); setQuestionForm({ keyId: question.keyId, questionText: question.questionText }); setEditingQuestion(true); setCreatingQuestion(false); }}>Edit</button><button type="button" disabled={pending} onClick={() => { if (window.confirm('Remove this Question from the Round? The server will reject removal if its history is immutable.')) removeQuestion.mutate({ eventId, roundId, id: question.id }); }}>Remove</button></>}</li>)}</ul>}
        {selectedRound && questions.data && <nav className={styles.pagination} aria-label="Question pages"><button type="button" disabled={questionPage <= 1 || pending} onClick={() => updateParams({ questionPage: String(questionPage - 1) })}>Previous</button><span>Page {questions.data.pagination.page} of {questions.data.pagination.totalPages}</span><button type="button" disabled={questionPage >= questions.data.pagination.totalPages || pending} onClick={() => updateParams({ questionPage: String(questionPage + 1) })}>Next</button></nav>}
        {selectedRound && selectedQuestionId && selectedQuestionId === selectedQuestion?.id && !editingQuestion && <article className={styles.detail}><h3>{selectedQuestion.keyValue}</h3><p>{selectedQuestion.questionText}</p></article>}
        {selectedRound && (creatingQuestion || editingQuestion) && <form className={styles.form} onSubmit={submitQuestion}><h3>{editingQuestion ? 'Edit Question' : 'Associate Question and Key'}</h3>{creatingQuestion && <label>Key<select required value={questionForm.keyId} disabled={pending} onChange={(e) => setQuestionForm({ ...questionForm, keyId: e.target.value })}><option value="">Choose a Key</option>{keys.data?.data.map((key) => <option key={key.id} value={key.id}>{key.value}</option>)}</select>{(keys.data?.pagination.totalPages ?? 1) > 1 && <small>Key selection shows this page of the Event Key pool; navigate Key pages to load other Keys.</small>}</label>}<label>Question text<textarea minLength={10} maxLength={500} required rows={4} value={questionForm.questionText} disabled={pending} onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })} /></label><p>10–500 characters. This is the clue shown to participants; its Key remains backend-managed.</p><div className={styles.actions}><button type="submit" disabled={pending || (creatingQuestion && !questionForm.keyId)}>{pending ? 'Saving…' : editingQuestion ? 'Save Question' : 'Save association'}</button><button type="button" disabled={pending} onClick={() => { setCreatingQuestion(false); setEditingQuestion(false); }}>Cancel</button></div></form>}
      </section>
    </div>
  </main>;
}
