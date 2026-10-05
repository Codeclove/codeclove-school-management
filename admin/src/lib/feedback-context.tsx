import React, { createContext, useContext, useState, useCallback } from 'react'

export interface FeedbackOptions {
  type?: 'bug' | 'feedback'
  priority?: 'p0' | 'p1' | 'p2' | 'p3'
  initialTitle?: string
  initialDescription?: string
  area?: string
  errorStack?: string
}

interface FeedbackContextType {
  isOpen: boolean
  options: FeedbackOptions
  openFeedback: (options?: FeedbackOptions) => void
  closeFeedback: () => void
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined)

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<FeedbackOptions>({})

  const openFeedback = useCallback((opts?: FeedbackOptions) => {
    setOptions(opts || {})
    setIsOpen(true)
  }, [])

  const closeFeedback = useCallback(() => {
    setIsOpen(false)
    setOptions({})
  }, [])

  return (
    <FeedbackContext.Provider value={{ isOpen, options, openFeedback, closeFeedback }}>
      {children}
    </FeedbackContext.Provider>
  )
}

export function useFeedbackModal(): FeedbackContextType {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedbackModal must be used within a FeedbackProvider')
  }
  return context
}
