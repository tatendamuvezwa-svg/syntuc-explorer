import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useCoordinatorAuth } from '../../context/CoordinatorAuthContext.tsx';

type Rating = 'Excellent' | 'Good' | 'Fair' | 'Poor';
type Ratings = {
  welcome: Rating | '';
  boatCleanliness: Rating | '';
  drinkVariety: Rating | '';
  snacks: Rating | '';
  captainInformation: Rating | '';
};

type FeedbackResponse = {
  id: string;
  experience: string;
  name: string | null;
  email: string | null;
  experienceDate: string | null;
  ratings: Record<string, Rating>;
  overallExperience: string;
  recommendation: 'Yes' | 'No';
  createdAt: string;
};

const ratingQuestions: { key: keyof Ratings; label: string }[] = [
  { key: 'welcome', label: 'How was our welcome?' },
  { key: 'boatCleanliness', label: 'Was our boat clean?' },
  { key: 'drinkVariety', label: 'Variety of drinks?' },
  { key: 'snacks', label: 'Our snacks?' },
  { key: 'captainInformation', label: 'Information from the captain?' },
];
const ratingOptions: Rating[] = ['Excellent', 'Good', 'Fair', 'Poor'];

const inputClass = 'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-800 outline-none transition focus:border-[#9A774B] focus:ring-2 focus:ring-[#9A774B]/15';
const labelClass = 'mb-2 block text-sm font-semibold text-stone-800';

function todayLocal(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export const FeedbackPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [experienceDate, setExperienceDate] = useState(todayLocal());
  const [ratings, setRatings] = useState<Ratings>({
    welcome: '',
    boatCleanliness: '',
    drinkVariety: '',
    snacks: '',
    captainInformation: '',
  });
  const [overallExperience, setOverallExperience] = useState('');
  const [recommendation, setRecommendation] = useState<'Yes' | 'No' | ''>('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const updateRating = (key: keyof Ratings, value: Rating) => {
    setRatings((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          experienceDate,
          ratings,
          overallExperience,
          recommendation,
          website,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Your feedback could not be submitted. Please try again.');
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your feedback could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F3EC] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#263B30] text-[#D6B57D]">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B765E]">SAINTECH · SYNTUC EXPLORER</p>
          <h1 className="mt-3 font-display text-3xl text-[#263B30] sm:text-4xl">Your experience matters.</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-600">
            Thank you for joining the Heritage Expedition Sunset Cruise. Please share your experience so the team can continue improving its service.
          </p>
        </header>

        {submitted ? (
          <section className="rounded-3xl border border-[#D8E3D5] bg-white p-7 text-center shadow-sm sm:p-10" role="status" aria-live="polite">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#54775A]" />
            <h2 className="mt-4 font-display text-2xl text-[#263B30]">Thank you for your feedback.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">Your response has been submitted. We appreciate you taking the time to help improve the guest experience.</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="rounded-2xl bg-[#F7F5EF] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Experience being reviewed</p>
              <p className="mt-1 text-lg font-semibold text-[#263B30]">Sunset Cruise</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">This is a pilot feedback form. Responses are not verified guest reviews.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="feedback-name" className={labelClass}>Name <span className="font-normal text-stone-400">(optional)</span></label>
                <input id="feedback-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" placeholder="Your name" />
              </div>
              <div>
                <label htmlFor="feedback-email" className={labelClass}>Email <span className="font-normal text-stone-400">(optional)</span></label>
                <input id="feedback-email" type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label htmlFor="feedback-date" className={labelClass}>Date of experience</label>
              <input id="feedback-date" type="date" className={inputClass} value={experienceDate} onChange={(event) => setExperienceDate(event.target.value)} max={todayLocal()} />
            </div>

            <div className="border-t border-stone-100 pt-5">
              <h2 className="font-display text-xl text-[#263B30]">How did we do?</h2>
              <p className="mt-1 text-sm text-stone-500">Select one rating for each question.</p>
              <div className="mt-5 space-y-5">
                {ratingQuestions.map((question, index) => (
                  <fieldset key={question.key}>
                    <legend className={labelClass}>{index + 1}. {question.label}</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {ratingOptions.map((option) => {
                        const selected = ratings[question.key] === option;
                        return (
                          <label key={option} className={`flex cursor-pointer items-center justify-center rounded-xl border px-2 py-3 text-sm font-medium transition ${selected ? 'border-[#496A50] bg-[#E8EFE8] text-[#263B30]' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}>
                            <input
                              type="radio"
                              name={question.key}
                              value={option}
                              checked={selected}
                              onChange={() => updateRating(question.key, option)}
                              required
                              className="sr-only"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-100 pt-5">
              <label htmlFor="feedback-overall" className={labelClass}>How was your overall experience?</label>
              <textarea id="feedback-overall" className={inputClass} rows={4} value={overallExperience} onChange={(event) => setOverallExperience(event.target.value)} maxLength={2000} required placeholder="Tell us what you enjoyed or what we could improve…" />
              <p className="mt-1 text-right text-xs text-stone-400">{overallExperience.length}/2000</p>
            </div>

            <fieldset className="border-t border-stone-100 pt-5">
              <legend className={labelClass}>Would you recommend us to friends?</legend>
              <div className="grid grid-cols-2 gap-3">
                {(['Yes', 'No'] as const).map((option) => (
                  <label key={option} className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition ${recommendation === option ? 'border-[#496A50] bg-[#E8EFE8] text-[#263B30]' : 'border-stone-200 text-stone-600 hover:border-stone-400'}`}>
                    <input type="radio" name="recommendation" value={option} checked={recommendation === option} onChange={() => setRecommendation(option)} required className="sr-only" />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="feedback-website">Leave this field empty</label>
              <input id="feedback-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </div>

            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#263B30] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#344D3D] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? 'Submitting feedback…' : 'Submit feedback'}
            </button>
            <p className="text-center text-xs leading-5 text-stone-400">Please avoid including sensitive personal information in your comments.</p>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-stone-400">Powered by Syntuc Explorer · SAINTECH</p>
      </div>
    </div>
  );
};

export const FeedbackAdminPage: React.FC<{ onBackToExplorer: () => void }> = ({ onBackToExplorer }) => {
  const { staffUser, isAuthenticated, loading, login, logout, error: authError } = useCoordinatorAuth();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [qrError, setQrError] = useState(false);

  const feedbackUrl = useMemo(() => `${window.location.origin}/feedback`, []);
  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=360x360&format=png&data=${encodeURIComponent(feedbackUrl)}`, [feedbackUrl]);

  const loadResponses = async () => {
    setLoadingResponses(true);
    setLoadError('');
    try {
      const token = localStorage.getItem('syntuc_staff_token') || '';
      const response = await fetch('/api/feedback/responses', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not load feedback responses.');
      setResponses(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setLoadError(loadError instanceof Error ? loadError.message : 'Could not load feedback responses.');
    } finally {
      setLoadingResponses(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && staffUser?.role === 'admin') void loadResponses();
  }, [isAuthenticated, staffUser?.role]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoggingIn(true);
    setActionError('');
    try {
      await login(emailInput, passwordInput);
    } catch (loginError) {
      setActionError(loginError instanceof Error ? loginError.message : 'Sign-in failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const visibleResponses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return responses;
    return responses.filter((item) =>
      [item.name, item.email, item.overallExperience, item.experience, item.recommendation, ...Object.values(item.ratings || {})]
        .some((value) => String(value || '').toLowerCase().includes(needle))
    );
  }, [responses, query]);

  const downloadCsv = () => {
    const headers = ['Submitted at', 'Experience date', 'Experience', 'Name', 'Email', ...ratingQuestions.map((item) => item.label), 'Overall experience', 'Would recommend'];
    const rows = visibleResponses.map((item) => [
      item.createdAt,
      item.experienceDate || '',
      item.experience,
      item.name || '',
      item.email || '',
      ...ratingQuestions.map((question) => item.ratings?.[question.key] || ''),
      item.overallExperience || '',
      item.recommendation || '',
    ]);
    const escapeCell = (value: unknown) => {
      const raw = String(value ?? '');
      // Prevent spreadsheet formula execution when guests' free-text is opened in Excel/Sheets.
      const safe = /^[\\s]*[=+\\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'syntuc-heritage-feedback.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadQr = async () => {
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error('QR image unavailable');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'syntuc-feedback-qr.png';
      anchor.click();
      URL.revokeObjectURL(url);
      setQrError(false);
    } catch {
      setQrError(true);
      window.open(qrUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] text-sm text-stone-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Checking staff access…</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] px-4 py-12">
        <div className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-[#263B30] p-3 text-[#D6B57D]"><LockKeyhole className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-widest text-stone-500">SAINTECH · SYNTUC</p><h1 className="text-xl font-semibold text-stone-900">Feedback management</h1></div></div>
          <p className="mb-5 text-sm leading-6 text-stone-600">Sign in with an authorised Syntuc administrator account to review submissions and generate the QR code.</p>
          {(authError || actionError) && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError || authError}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label htmlFor="feedback-admin-email" className={labelClass}>Staff email</label><input id="feedback-admin-email" type="email" required autoComplete="username" className={inputClass} value={emailInput} onChange={(event) => setEmailInput(event.target.value)} /></div>
            <div><label htmlFor="feedback-admin-password" className={labelClass}>Password</label><input id="feedback-admin-password" type="password" required autoComplete="current-password" className={inputClass} value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} /></div>
            <button disabled={loggingIn} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#263B30] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loggingIn ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{loggingIn ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <button onClick={onBackToExplorer} className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="h-4 w-4" /> Return to Explorer</button>
        </div>
      </div>
    );
  }

  if (staffUser?.role !== 'admin') {
    return <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF8F5] px-4 text-center"><LockKeyhole className="h-10 w-10 text-stone-400" /><h1 className="mt-4 text-xl font-semibold text-stone-900">Administrator access required</h1><p className="mt-2 max-w-md text-sm text-stone-600">Your account is signed in, but this pilot's feedback records are restricted to administrators.</p><button onClick={logout} className="mt-5 rounded-xl bg-[#263B30] px-4 py-2.5 text-sm font-semibold text-white">Sign out</button><button onClick={onBackToExplorer} className="mt-3 text-sm text-stone-500">Return to Explorer</button></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] px-4 py-8 sm:px-6">
      <style>{`@media print { body * { visibility: hidden !important; } .feedback-qr-print, .feedback-qr-print * { visibility: visible !important; } .feedback-qr-print { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; } }`}</style>
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6B765E]">SAINTECH · SYNTUC EXPLORER</p><h1 className="mt-2 font-display text-3xl text-[#263B30]">Guest feedback</h1><p className="mt-1 text-sm text-stone-500">Heritage Expedition pilot · Sunset Cruise</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onBackToExplorer} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700"><ArrowLeft className="mr-1 inline h-4 w-4" /> Explorer</button>
            <button onClick={() => { logout(); }} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">Sign out</button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <section className="feedback-qr-print rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-[#496A50]" /><h2 className="font-semibold text-stone-900">Guest QR code</h2></div>
            <p className="mt-2 text-sm leading-5 text-stone-500">Print this code or place it on a guest information card. Anyone who scans it can open the public questionnaire.</p>
            <div className="mx-auto mt-4 flex max-w-[250px] items-center justify-center rounded-2xl border border-stone-100 bg-white p-3">
              <img src={qrUrl} alt="QR code linking to the Syntuc guest feedback form" className="aspect-square w-full" onError={() => setQrError(true)} />
            </div>
            <p className="mt-3 break-all text-center text-xs text-stone-500">{feedbackUrl}</p>
            {qrError && <p role="status" className="mt-2 text-xs text-amber-700">If download fails, open the QR image in a new tab and save it from your browser.</p>}
            <div className="no-print mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => void downloadQr()} className="flex items-center justify-center gap-2 rounded-xl bg-[#263B30] px-3 py-2.5 text-xs font-semibold text-white"><Download className="h-4 w-4" /> Download</button>
              <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-semibold text-stone-700"><ExternalLink className="h-4 w-4" /> Print QR</button>
            </div>
            <p className="no-print mt-3 text-xs leading-5 text-stone-400">QR image is generated by an external QR service using the public feedback URL. Do not encode private guest details in the QR code.</p>
          </section>

          <section className="min-w-0 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#496A50]" /><h2 className="font-semibold text-stone-900">Submitted responses</h2></div><p className="mt-1 text-sm text-stone-500">{visibleResponses.length} response{visibleResponses.length === 1 ? '' : 's'} shown · maximum 500 loaded</p></div>
              <div className="flex gap-2">
                <button onClick={() => void loadResponses()} disabled={loadingResponses} className="rounded-xl border border-stone-200 p-2.5 text-stone-600 disabled:opacity-50" aria-label="Refresh responses"><RefreshCw className={`h-4 w-4 ${loadingResponses ? 'animate-spin' : ''}`} /></button>
                <button onClick={downloadCsv} disabled={visibleResponses.length === 0} className="flex items-center gap-2 rounded-xl bg-[#263B30] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Download className="h-4 w-4" /> Export CSV</button>
              </div>
            </div>
            <div className="mt-4"><input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="Search names, comments or ratings…" aria-label="Search feedback" /></div>
            {loadError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</div>}
            {actionError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</div>}
            {loadingResponses ? <div className="flex items-center justify-center py-12 text-sm text-stone-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading responses…</div> : visibleResponses.length === 0 ? <div className="py-12 text-center"><Star className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-medium text-stone-600">No feedback responses yet</p><p className="mt-1 text-xs text-stone-400">Submissions will appear here after the public form is used.</p></div> : (
              <div className="mt-4 space-y-3">
                {visibleResponses.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-stone-900">{item.name || 'Guest (name not provided)'}</h3><p className="mt-0.5 text-xs text-stone-500">{item.email || 'No email provided'} · {item.experienceDate || 'Experience date not provided'}</p></div><span className="text-xs text-stone-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Submission time unavailable'}</span></div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {ratingQuestions.map((question) => <div key={question.key} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-xs"><span className="text-stone-600">{question.label}</span><strong className="text-stone-800">{item.ratings?.[question.key] || '—'}</strong></div>)}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{item.overallExperience}</p>
                    <p className="mt-2 text-xs font-semibold text-[#496A50]">Would recommend: {item.recommendation || 'Not answered'}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        <p className="mt-6 text-xs leading-5 text-stone-400">Pilot note: public QR access does not verify that a respondent was a paying or boarded guest. Keep this feedback data separate from other Syntuc tenants and do not treat responses as authenticated reviews.</p>
      </div>
    </div>
  );
};
