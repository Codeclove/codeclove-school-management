import { useState } from 'react'
import { Star, Sparkles, X, HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { dismissReviewPrompt, type ReviewPromptAction } from '@/api/review-prompt'
import { __, sprintf } from '@/lib/i18n'

export function ReviewPromptBanner() {
  const [dismissedLocally, setDismissedLocally] = useState(false)

  const config = typeof window !== 'undefined' ? window.CodeCloveConfig?.reviewPrompt : undefined
  const shouldShow = Boolean(config?.shouldShow ?? config?.should_show)

  if (!shouldShow || dismissedLocally) {
    return null
  }

  const reviewUrl =
    config?.reviewUrl ||
    config?.review_url ||
    'https://wordpress.org/support/plugin/codeclove-school-management/reviews/#new-post'

  const supportUrl =
    config?.supportUrl ||
    config?.support_url ||
    'https://wordpress.org/support/plugin/codeclove-school-management/'

  const triggerReason = config?.triggerReason ?? config?.trigger_reason ?? 'students_count'
  const studentsCount = config?.studentsCount ?? config?.students_count ?? 5
  const daysPassed = config?.daysPassed ?? config?.days_passed ?? 5

  const description =
    triggerReason === 'days_passed'
      ? sprintf(
          __(
            "You've been using CodeClove for %d days! If you find it helpful, would you consider leaving us a quick 5-star review?",
            'codeclove-school-management'
          ),
          daysPassed
        )
      : sprintf(
          __(
            'Congratulations on enrolling %d students! We hope CodeClove is making your school administration easier. Could you take 30 seconds to rate us on WordPress.org?',
            'codeclove-school-management'
          ),
          studentsCount
        )

  const dismissWithAction = (action: ReviewPromptAction) => {
    setDismissedLocally(true)
    dismissReviewPrompt(action).catch((err) => {
      console.error(`Failed to dismiss review prompt with action ${action}:`, err)
    })
  }

  const handleReview = () => {
    dismissWithAction('reviewed')
    window.open(reviewUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="p-4 sm:p-5 border border-amber-500/30 bg-bg-elevated shadow-sm relative">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">
              {__( 'Loving CodeClove? ⭐', 'codeclove-school-management' )}
            </h3>
            <div className="flex items-center gap-1 text-amber-500" aria-label="5 stars">
              <div className="flex items-center gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <Sparkles className="w-4 h-4 ml-0.5 text-amber-500" />
            </div>
          </div>
          <p className="text-sm text-text-muted leading-relaxed max-w-3xl">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              variant="default"
              onClick={handleReview}
              className="gap-1.5 font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-sm border-0"
            >
              ★ {__( 'Leave a 5-Star Review', 'codeclove-school-management' )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => dismissWithAction('maybe_later')}
            >
              {__( 'Remind me in 2 weeks', 'codeclove-school-management' )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => dismissWithAction('reviewed')}
            >
              {__( 'Already Reviewed', 'codeclove-school-management' )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => dismissWithAction('never')}
              className="text-text-muted hover:text-text"
            >
              {__( "Don't Ask Again", 'codeclove-school-management' )}
            </Button>
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-strong hover:underline font-medium ml-1"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{__( 'Need Help?', 'codeclove-school-management' )}</span>
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismissWithAction('never')}
          className="text-text-muted hover:text-text rounded-md p-1 transition-colors -mr-1 -mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label={__( 'Dismiss', 'codeclove-school-management' )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  )
}

export default ReviewPromptBanner
