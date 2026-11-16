import { COMPREHENSION_CHECK } from './http-caching-lesson';

interface ComprehensionCheckProps {
  readonly hidden: boolean;
  readonly answers: Readonly<Record<string, string>>;
  readonly checked: boolean;
  readonly onAnswer: (questionId: string, optionId: string) => void;
  readonly onSubmit: () => void;
}

/** Fixed check for the bundled lesson. Answers are kept for this session and never scored remotely. */
export function ComprehensionCheck({
  hidden,
  answers,
  checked,
  onAnswer,
  onSubmit,
}: ComprehensionCheckProps) {
  const answered = COMPREHENSION_CHECK.filter((q) => answers[q.id] !== undefined).length;
  const correct = COMPREHENSION_CHECK.filter((q) => answers[q.id] === q.answerId).length;
  return (
    <section className="comprehension-check" hidden={hidden} aria-labelledby="check-heading">
      <h2 id="check-heading">Check your understanding</h2>
      <p className="muted">
        {COMPREHENSION_CHECK.length} questions about the lesson. This is practice for you, not a
        measure of ability.
      </p>
      {COMPREHENSION_CHECK.map((question, index) => (
        <fieldset key={question.id}>
          <legend>
            {index + 1}. {question.prompt}
          </legend>
          {question.options.map((option) => (
            <label key={option.id} className="choice">
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={answers[question.id] === option.id}
                onChange={() => {
                  onAnswer(question.id, option.id);
                }}
              />
              {option.label}
            </label>
          ))}
          {checked && answers[question.id] !== undefined && (
            <p className={answers[question.id] === question.answerId ? 'success' : 'field-error'}>
              {answers[question.id] === question.answerId ? '✓ Correct. ' : '✗ Not quite. '}
              {question.rationale}
            </p>
          )}
        </fieldset>
      ))}
      <button type="button" className="primary" disabled={answered === 0} onClick={onSubmit}>
        {checked ? 'Check again' : 'Check answers'}
      </button>
      {checked && (
        <p role="status">
          {correct} of {COMPREHENSION_CHECK.length} correct
          {answered < COMPREHENSION_CHECK.length
            ? ` (${COMPREHENSION_CHECK.length - answered} unanswered)`
            : ''}
          .
        </p>
      )}
    </section>
  );
}
