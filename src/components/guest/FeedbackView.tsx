import React, { useState } from 'react';
import {
  Ship,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.ts';

interface FeedbackViewProps {
  onBackToExplore?: () => void;
}

interface RatingQuestion {
  id: 'welcome' | 'cleanliness' | 'drinks' | 'snacks' | 'captainInfo';
  label: string;
  helper?: string;
}

const RATING_QUESTIONS: RatingQuestion[] = [
  {
    id: 'welcome',
    label: 'Welcome and reception',
    helper: 'Greeting at the jetty and boarding experience',
  },
  {
    id: 'cleanliness',
    label: 'Boat cleanliness',
    helper: 'Condition of the deck, seating, and onboard facilities',
  },
  {
    id: 'drinks',
    label: 'Variety of drinks',
    helper: 'Selection and quality of onboard beverages',
  },
  {
    id: 'snacks',
    label: 'Snacks',
    helper: 'Taste, presentation, and freshness of refreshments',
  },
  {
    id: 'captainInfo',
    label: "Captain's information",
    helper: 'Commentary, safety briefing, and river insights',
  },
];

const RATING_VALUES = [
  { value: 1, label: '1 - Poor' },
  { value: 2, label: '2 - Fair' },
  { value: 3, label: '3 - Good' },
  { value: 4, label: '4 - Very Good' },
  { value: 5, label: '5 - Excellent' },
];

export const FeedbackView: React.FC<FeedbackViewProps> = ({ onBackToExplore }) => {
  const [ratings, setRatings] = useState<Record<string, number | null>>({
    welcome: null,
    cleanliness: null,
    drinks: null,
    snacks: null,
    captainInfo: null,
  });

  const [recommend, setRecommend] = useState<'yes' | 'no' | null>(null);
  const [overallComments, setOverallComments] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleRatingSelect = (questionId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [questionId]: value }));
  };

  // Validation: 5 rating questions and Recommend question are required
  const missingRatings = RATING_QUESTIONS.filter((q) => ratings[q.id] === null);
  const isMissingRecommend = recommend === null;
  const isValid = missingRatings.length === 0 && !isMissingRecommend;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedSubmit(true);
    setSubmitError(null);

    if (!isValid) {
      // Find first invalid section and scroll to it
      const firstError = document.querySelector('[data-has-error="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.submitBoatCruiseReview({
        welcomeRating: ratings.welcome!,
        cleanlinessRating: ratings.cleanliness!,
        drinksRating: ratings.drinks!,
        snacksRating: ratings.snacks!,
        captainInfoRating: ratings.captainInfo!,
        recommend: recommend!,
        overallComments: overallComments.trim() || undefined,
        guestName: guestName.trim() || undefined,
        guestEmail: guestEmail.trim() || undefined,
      });

      // Show success screen only after backend confirms persistence
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to submit your review. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setRatings({
      welcome: null,
      cleanliness: null,
      drinks: null,
      snacks: null,
      captainInfo: null,
    });
    setRecommend(null);
    setOverallComments('');
    setGuestName('');
    setGuestEmail('');
    setTouchedSubmit(false);
    setSubmitError(null);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#D8E3D5] p-6 sm:p-10 shadow-[0_16px_40px_rgba(38,59,48,0.08)] text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#EBF3EA] text-[#2C5234] flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-[#8B6A3E] mb-2">
            Heritage Expedition Boat Cruise Review
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#20372B] mb-3">
            Thank You for Your Feedback
          </h2>
          <p className="text-sm sm:text-base text-[#4A5D50] leading-relaxed mb-8">
            Your review has been saved to our guest register. Thank you for sharing your experience on the Zambezi River with us.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-3 rounded-xl border border-[#D8E3D5] text-sm font-medium text-[#20372B] hover:bg-[#F4F7F3] transition-colors"
            >
              Submit another response
            </button>
            {onBackToExplore && (
              <button
                type="button"
                onClick={onBackToExplore}
                className="px-5 py-3 rounded-xl bg-[#20372B] text-white text-sm font-medium hover:bg-[#2C5234] transition-colors shadow-sm"
              >
                Back to Syntuc Explorer
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back navigation */}
        {onBackToExplore && (
          <button
            type="button"
            onClick={onBackToExplore}
            className="inline-flex items-center gap-2 text-sm text-[#4A5D50] hover:text-[#20372B] mb-6 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Explorer</span>
          </button>
        )}

        {/* Page Header */}
        <header className="bg-white rounded-3xl border border-[#D8E3D5] p-6 sm:p-8 mb-6 shadow-[0_8px_24px_rgba(38,59,48,0.04)]">
          <div className="flex items-center gap-3 text-[#8B6A3E] text-xs font-semibold uppercase tracking-wider mb-2">
            <Ship className="w-4 h-4" />
            <span>Guest Experience Review</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#20372B] mb-2">
            Heritage Expedition Boat Cruise Review
          </h1>
          <p className="text-sm text-[#4A5D50] leading-relaxed">
            Please take a moment to share your feedback from your voyage on the Zambezi River. Your ratings help our crew deliver an exceptional safari experience.
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Section: Experience Ratings */}
          <section className="bg-white rounded-3xl border border-[#D8E3D5] p-6 sm:p-8 shadow-[0_8px_24px_rgba(38,59,48,0.04)]">
            <div className="flex items-center gap-2 text-[#20372B] font-semibold text-base mb-1">
              <Sparkles className="w-4 h-4 text-[#8B6A3E]" />
              <h2>Rate Your Experience</h2>
            </div>
            <p className="text-xs text-[#5D7063] mb-6">
              Required ratings. Select a score from 1 (Poor) to 5 (Excellent).
            </p>

            <div className="space-y-6 divide-y divide-[#EDF2EB]">
              {RATING_QUESTIONS.map((q, idx) => {
                const currentVal = ratings[q.id];
                const hasError = touchedSubmit && currentVal === null;

                return (
                  <fieldset
                    key={q.id}
                    data-has-error={hasError}
                    className={`pt-5 first:pt-0 ${hasError ? 'rounded-2xl p-4 -mx-2 bg-[#FDF5F4] border border-[#F2C4BE]' : ''}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-3">
                      <div>
                        <legend className="text-sm font-semibold text-[#20372B]">
                          {idx + 1}. {q.label} <span className="text-[#B9382B]">*</span>
                        </legend>
                        {q.helper && (
                          <p className="text-xs text-[#6B7D71] mt-0.5">{q.helper}</p>
                        )}
                      </div>
                      {currentVal !== null && (
                        <span className="text-xs font-medium text-[#2C5234] bg-[#EBF3EA] px-2 py-0.5 rounded-full self-start sm:self-auto">
                          {RATING_VALUES.find((r) => r.value === currentVal)?.label}
                        </span>
                      )}
                    </div>

                    {/* Mobile-friendly 1-5 selection grid */}
                    <div className="grid grid-cols-5 gap-2 sm:gap-3">
                      {RATING_VALUES.map((r) => {
                        const isSelected = currentVal === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleRatingSelect(q.id, r.value)}
                            aria-label={`${q.label}: ${r.label}`}
                            aria-pressed={isSelected}
                            className={`min-h-[48px] rounded-2xl flex flex-col items-center justify-center font-medium transition-all text-sm ${
                              isSelected
                                ? 'bg-[#20372B] text-white shadow-sm ring-2 ring-[#20372B] ring-offset-2'
                                : 'bg-[#F6F8F5] text-[#29342D] hover:bg-[#EBF1EA] border border-[#E0E7DE]'
                            } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <span className="text-base font-semibold">{r.value}</span>
                            <span className="hidden sm:inline text-[10px] opacity-80 mt-0.5">
                              {r.value === 1 ? 'Poor' : r.value === 5 ? 'Exc' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {hasError && (
                      <p className="flex items-center gap-1.5 text-xs text-[#B9382B] mt-2 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Please select a rating for {q.label.toLowerCase()}.</span>
                      </p>
                    )}
                  </fieldset>
                );
              })}
            </div>
          </section>

          {/* Section: Recommendation */}
          <section
            data-has-error={touchedSubmit && isMissingRecommend}
            className={`bg-white rounded-3xl border border-[#D8E3D5] p-6 sm:p-8 shadow-[0_8px_24px_rgba(38,59,48,0.04)] ${
              touchedSubmit && isMissingRecommend
                ? 'bg-[#FDF5F4] border-[#F2C4BE]'
                : ''
            }`}
          >
            <fieldset>
              <legend className="text-sm font-semibold text-[#20372B] mb-1">
                Would you recommend this experience? <span className="text-[#B9382B]">*</span>
              </legend>
              <p className="text-xs text-[#6B7D71] mb-4">
                Would you recommend the Heritage Expedition Boat Cruise to fellow travelers?
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRecommend('yes')}
                  aria-pressed={recommend === 'yes'}
                  className={`min-h-[48px] rounded-2xl flex items-center justify-center gap-2.5 font-medium transition-all text-sm ${
                    recommend === 'yes'
                      ? 'bg-[#20372B] text-white shadow-sm ring-2 ring-[#20372B] ring-offset-2'
                      : 'bg-[#F6F8F5] text-[#29342D] hover:bg-[#EBF1EA] border border-[#E0E7DE]'
                  } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Yes</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRecommend('no')}
                  aria-pressed={recommend === 'no'}
                  className={`min-h-[48px] rounded-2xl flex items-center justify-center gap-2.5 font-medium transition-all text-sm ${
                    recommend === 'no'
                      ? 'bg-[#20372B] text-white shadow-sm ring-2 ring-[#20372B] ring-offset-2'
                      : 'bg-[#F6F8F5] text-[#29342D] hover:bg-[#EBF1EA] border border-[#E0E7DE]'
                  } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>No</span>
                </button>
              </div>

              {touchedSubmit && isMissingRecommend && (
                <p className="flex items-center gap-1.5 text-xs text-[#B9382B] mt-3 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Please indicate whether you would recommend this experience.</span>
                </p>
              )}
            </fieldset>
          </section>

          {/* Section: Comments & Guest Info (Optional) */}
          <section className="bg-white rounded-3xl border border-[#D8E3D5] p-6 sm:p-8 shadow-[0_8px_24px_rgba(38,59,48,0.04)] space-y-5">
            <div>
              <label htmlFor="feedback-comments" className="block text-sm font-semibold text-[#20372B] mb-1">
                Overall comments <span className="text-xs font-normal text-[#6B7D71]">(optional)</span>
              </label>
              <p className="text-xs text-[#6B7D71] mb-2">
                Highlights, suggestions, or mentions of standout crew members.
              </p>
              <textarea
                id="feedback-comments"
                rows={4}
                disabled={isSubmitting}
                value={overallComments}
                onChange={(e) => setOverallComments(e.target.value)}
                placeholder="Share any highlights or suggestions for our crew..."
                className="w-full px-4 py-3 rounded-2xl bg-[#FBFBF9] border border-[#D8E3D5] text-[#20372B] placeholder:text-[#9BAAA0] text-sm focus:border-[#20372B] focus:bg-white focus:outline-none transition-colors disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="feedback-name" className="block text-sm font-semibold text-[#20372B] mb-1">
                  Guest name <span className="text-xs font-normal text-[#6B7D71]">(optional)</span>
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  disabled={isSubmitting}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FBFBF9] border border-[#D8E3D5] text-[#20372B] placeholder:text-[#9BAAA0] text-sm focus:border-[#20372B] focus:bg-white focus:outline-none transition-colors disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="feedback-email" className="block text-sm font-semibold text-[#20372B] mb-1">
                  Guest email <span className="text-xs font-normal text-[#6B7D71]">(optional)</span>
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  disabled={isSubmitting}
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FBFBF9] border border-[#D8E3D5] text-[#20372B] placeholder:text-[#9BAAA0] text-sm focus:border-[#20372B] focus:bg-white focus:outline-none transition-colors disabled:opacity-60"
                />
              </div>
            </div>
          </section>

          {/* Validation banner if submitted with errors */}
          {touchedSubmit && !isValid && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-[#FDF5F4] border border-[#F2C4BE] text-[#9A2D22] text-sm flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Please complete all required fields.</p>
                <p className="text-xs mt-0.5 text-[#B9382B]">
                  Ratings are required for all 5 aspects of the cruise, along with your recommendation.
                </p>
              </div>
            </div>
          )}

          {/* Actionable error banner if submission failed */}
          {submitError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-[#FDF5F4] border border-[#F2C4BE] text-[#9A2D22] text-sm flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Review Submission Failed</p>
                <p className="text-xs mt-0.5 text-[#B9382B]">{submitError}</p>
                <p className="text-xs mt-1 text-[#6B7D71]">
                  Your answers are preserved. Please click "Submit Review" to try again.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 pb-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full min-h-[52px] rounded-2xl bg-[#20372B] hover:bg-[#2C5234] text-white font-medium text-base shadow-[0_4px_16px_rgba(32,55,43,0.18)] transition-all flex items-center justify-center gap-2 ${
                isSubmitting ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting Review...</span>
                </>
              ) : submitError ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Submission</span>
                </>
              ) : (
                <span>Submit Review</span>
              )}
            </button>
            <p className="text-center text-xs text-[#7A8E81] mt-3">
              Heritage Expedition Boat Cruise Review • Pure Africa Experiences
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
