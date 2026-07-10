import { Children, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import '../../styles/react-bits-campus.css'

const MotionDiv = motion.div

export function Step({ children }) {
  return <div className="rb-stepper__step">{children}</div>
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange,
  onBeforeStepChange,
  onFinalStepCompleted,
  backButtonText = '上一步',
  nextButtonText = '继续',
  completeButtonText = '进入校园集市',
  disableStepIndicators = true,
  busy = false,
}) {
  const steps = Children.toArray(children)
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [direction, setDirection] = useState(1)

  const moveTo = (nextStep) => {
    setDirection(nextStep > currentStep ? 1 : -1)
    setCurrentStep(nextStep)
    onStepChange?.(nextStep)
  }

  const next = async () => {
    if (busy) return
    const allowed = await onBeforeStepChange?.(currentStep)
    if (allowed === false) return
    if (currentStep === steps.length) {
      await onFinalStepCompleted?.()
      return
    }
    moveTo(currentStep + 1)
  }

  return (
    <section className="rb-stepper">
      <div className="rb-stepper__indicators" aria-label={`第 ${currentStep} 步，共 ${steps.length} 步`}>
        {steps.map((_, index) => {
          const number = index + 1
          const complete = number < currentStep
          const active = number === currentStep
          return (
            <div className="rb-stepper__indicator-wrap" key={number}>
              <button
                type="button"
                className={`rb-stepper__indicator ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`.trim()}
                disabled={disableStepIndicators || busy}
                onClick={() => moveTo(number)}
                aria-label={`第 ${number} 步`}
                aria-current={active ? 'step' : undefined}
              >
                {complete ? <Check /> : number}
              </button>
              {number < steps.length ? <span className={complete ? 'is-complete' : ''} /> : null}
            </div>
          )
        })}
      </div>

      <div className="rb-stepper__content">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <MotionDiv
            key={currentStep}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 36 : -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -26 : 26 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {steps[currentStep - 1]}
          </MotionDiv>
        </AnimatePresence>
      </div>

      <footer className="rb-stepper__footer">
        <button type="button" className="rb-stepper__back" disabled={currentStep === 1 || busy} onClick={() => moveTo(currentStep - 1)}>
          {backButtonText}
        </button>
        <button type="button" className="rb-stepper__next" disabled={busy} onClick={next}>
          {busy ? '保存中…' : currentStep === steps.length ? completeButtonText : nextButtonText}
        </button>
      </footer>
    </section>
  )
}
