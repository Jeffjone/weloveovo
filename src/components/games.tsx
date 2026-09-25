'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Disc3, ScanEye, Clock3, Users, Check, RotateCcw } from 'lucide-react';
import {
  gameModes,
  emptyProgress,
  readProgress,
  type GameMode,
  type Question,
  type Answer,
  type GameProgress,
} from '@/lib/game-types';
import { TrackActions } from './experience';
import { RandomSong } from './random-song';
import { ui } from './ui';
import s from './games.module.css';
const icons = [Disc3, ScanEye, Clock3, Users];
const storageKey = 'weloveovo.learning.v1';
async function requestJSON(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The round could not be loaded. Try again.');
  return data;
}
export function Games({
  total,
  initialMode = 'release',
}: {
  total: number;
  initialMode?: GameMode;
}) {
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<{ question: Question; result: Answer }[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [progress, setProgress] = useState<GameProgress>(emptyProgress);
  const [localOnly, setLocalOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      setProgress(readProgress(localStorage.getItem(storageKey)));
    } catch {
      setLocalOnly(true);
    }
    setReady(true);
    return () => operation.current?.abort();
  }, []);
  useEffect(() => {
    if (questions.length) heading.current?.focus();
  }, [index, questions]);
  useEffect(() => {
    if (answer) feedback.current?.focus();
  }, [answer]);
  const question = questions[index];
  const finished = questions.length > 0 && index >= questions.length;
  const score = answers.filter((item) => item.result.correct).length;
  const misses = answers.filter((item) => !item.result.correct);
  function reset() {
    operation.current?.abort();
    operation.current = null;
    setQuestions([]);
    setAnswers([]);
    setIndex(0);
    setAnswer(null);
    setSelected('');
    setError('');
    setBusy(false);
  }
  async function start() {
    if (operation.current) return;
    const abort = new AbortController();
    operation.current = abort;
    setBusy(true);
    setError('');
    try {
      const data = await requestJSON('/api/games?mode=' + mode, {
        signal: abort.signal,
        cache: 'no-store',
      });
      if (!data.questions.length)
        throw new Error('There are no questions for this mode yet. Choose another mode.');
      setQuestions(data.questions);
      setIndex(0);
      setAnswer(null);
      setSelected('');
      setAnswers([]);
    } catch (error) {
      if (!abort.signal.aborted) setError((error as Error).message);
    } finally {
      if (!abort.signal.aborted) {
        operation.current = null;
        setBusy(false);
      }
    }
  }
  async function choose(choice: string) {
    if (!question || answer || operation.current) return;
    const abort = new AbortController();
    operation.current = abort;
    setBusy(true);
    setSelected(choice);
    setError('');
    try {
      const result: Answer = await requestJSON('/api/games/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: question.id, mode: question.mode, choice }),
        signal: abort.signal,
      });
      setAnswer(result);
      setAnswers((items) => [...items, { question, result }]);
      const next = {
        attempted: progress.attempted + 1,
        correct: progress.correct + Number(result.correct),
        tracks: [...new Set([...progress.tracks, question.id])],
      };
      setProgress(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        setLocalOnly(true);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        setError((error as Error).message);
        setSelected('');
      }
    } finally {
      if (!abort.signal.aborted) {
        operation.current = null;
        setBusy(false);
      }
    }
  }
  function nextQuestion() {
    setIndex((n) => n + 1);
    setAnswer(null);
    setSelected('');
    setError('');
  }
  function review() {
    setQuestions(misses.map((item) => item.question));
    setAnswers([]);
    setIndex(0);
    setAnswer(null);
    setSelected('');
    setError('');
  }
  return (
    <div className={s.layout}>
      <section className={s.main} aria-label="Learning game">
        {!questions.length ? (
          <>
            <p className={ui.eyebrow}>
              TEN QUESTIONS / NO TIMER / EVERY ANSWER TEACHES YOU SOMETHING
            </p>
            <h2 className={s.title}>
              How well do you
              <br />
              <em>know the catalog?</em>
            </h2>
            <div className={s.modes} role="group" aria-label="Game mode">
              {gameModes.map((item, i) => {
                const Icon = icons[i];
                return (
                  <button
                    key={item.id}
                    disabled={busy}
                    className={mode === item.id ? s.active : ''}
                    aria-pressed={mode === item.id}
                    onClick={() => {
                      setMode(item.id);
                      setError('');
                    }}
                  >
                    <Icon size={23} />
                    <small>{item.label}</small>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                );
              })}
            </div>
            <button
              className={ui.primaryButton}
              disabled={busy || !ready}
              onClick={() => void start()}
            >
              {busy ? 'Building your round…' : 'Start a round'}
              <ArrowRight size={16} />
            </button>
            <p className={s.note}>
              Answers follow the releases and editions in this collection. A song may appear on
              other editions too.
            </p>
          </>
        ) : finished ? (
          <div className={s.finish}>
            <p className={ui.eyebrow}>ROUND COMPLETE</p>
            <h2 ref={heading} tabIndex={-1} className={s.title}>
              {score}
              <span> / {questions.length}</span>
            </h2>
            <h3>
              {score === questions.length
                ? 'You know your way around.'
                : 'Every listen leaves a little more behind.'}
            </h3>
            <p>Keep exploring the songs, then come back for another round.</p>
            <div className={ui.actions}>
              {misses.length > 0 && (
                <button className={ui.primaryButton} onClick={review}>
                  <RotateCcw size={15} />
                  Review {misses.length} missed answers
                </button>
              )}
              <button className={ui.outlineButton} onClick={reset}>
                Choose another round
              </button>
            </div>
            <div className={s.review}>
              {answers.map(({ question: q, result }, i) => (
                <Link key={q.id + i} href={'/tracks/' + q.id}>
                  <span>{result.correct ? '✓' : '↗'}</span>
                  <strong>{result.track.title}</strong>
                  <small>{result.track.release_title}</small>
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className={s.roundBar}>
              <span>
                QUESTION {index + 1} / {questions.length}
              </span>
              <button onClick={reset}>Back to games</button>
            </div>
            <progress
              className={s.progress}
              value={index + Number(Boolean(answer))}
              max={questions.length}
              aria-label="Round progress"
            />
            <div className={s.question}>
              {question.image && (
                <img src={question.image} alt="Record cover to identify" width="240" height="240" />
              )}
              <div>
                <p className={ui.eyebrow}>{question.prompt}</p>
                <h2 ref={heading} tabIndex={-1} className={s.questionTitle}>
                  {question.subject}
                </h2>
              </div>
            </div>
            <div className={s.choices} aria-label="Answer choices">
              {question.choices.map((choice, i) => (
                <button
                  key={choice.id}
                  disabled={busy || Boolean(answer)}
                  aria-pressed={selected === choice.id}
                  className={
                    answer?.answer === choice.id
                      ? s.correct
                      : answer && selected === choice.id
                        ? s.incorrect
                        : ''
                  }
                  onClick={() => void choose(choice.id)}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {choice.label}
                  {answer?.answer === choice.id && <Check size={16} />}
                </button>
              ))}
            </div>
            {busy && (
              <p role="status" className={s.note}>
                Checking your answer…
              </p>
            )}
            {answer && (
              <div ref={feedback} tabIndex={-1} className={s.feedback} role="status">
                <p className={ui.eyebrow}>
                  {answer.correct ? 'RIGHT ON THE RECORD' : 'ONE TO REMEMBER'}
                </p>
                <h3>{question.choices.find((c) => c.id === answer.answer)?.label}</h3>
                <p>{answer.explanation}</p>
                <div className={ui.actions}>
                  <Link href={'/tracks/' + answer.track.id} className={ui.outlineButton}>
                    Read about this song ↗
                  </Link>
                  <TrackActions track={answer.track} compact />
                </div>
                <button className={ui.primaryButton} onClick={nextQuestion}>
                  {index + 1 === questions.length ? 'See results' : 'Next question'}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
        {error && (
          <div role="alert" className={ui.error}>
            {error} {question && !answer && <span>Select an answer again to retry.</span>}
          </div>
        )}
      </section>
      <aside className={s.aside}>
        <p className={ui.eyebrow}>YOUR LISTENING MEMORY</p>
        <strong className={s.bigNumber}>
          {progress.tracks.length}
          <span> / {total}</span>
        </strong>
        <p>Songs studied in this browser</p>
        <div className={s.stats}>
          <span>
            <b>{progress.correct}</b>correct answers
          </span>
          <span>
            <b>{progress.attempted}</b>questions explored
          </span>
        </div>
        <p className={s.note}>
          {localOnly
            ? 'Storage is unavailable. Progress lasts for this visit.'
            : 'Progress stays on this browser. No account needed.'}
        </p>
        <hr className={ui.divider} />
        <h3>Learn by wandering.</h3>
        <p>Open a song file. Meet its collaborators. Follow it back to the record.</p>
        <RandomSong />
        <Link className={s.catalogLink} href="/listening-room">
          Browse the song cards <ArrowRight size={14} />
        </Link>
      </aside>
    </div>
  );
}
