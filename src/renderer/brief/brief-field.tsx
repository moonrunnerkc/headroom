import { FIELD_SPECS, type BriefFieldId } from '../../domain/brief';

interface BriefFieldProps {
  readonly id: BriefFieldId;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (id: BriefFieldId, value: string) => void;
  readonly onBlur: (id: BriefFieldId) => void;
}

export const fieldDomId = (id: BriefFieldId) => `brief-field-${id}`;

/** One form control with its label, instructions, and error programmatically associated. */
export function BriefField({ id, value, error, onChange, onBlur }: BriefFieldProps) {
  const spec = FIELD_SPECS[id];
  const domId = fieldDomId(id);
  const helpId = `${domId}-help`;
  const errorId = `${domId}-error`;
  const describedBy = error === undefined ? helpId : `${helpId} ${errorId}`;
  const common = {
    id: domId,
    name: id,
    value,
    'aria-describedby': describedBy,
    'aria-invalid': error !== undefined,
    'aria-required': spec.required,
    onBlur: () => {
      onBlur(id);
    },
  };
  const changeHandler = (event: { currentTarget: { value: string } }) => {
    onChange(id, event.currentTarget.value);
  };
  return (
    <div className="field" data-invalid={error !== undefined}>
      <label htmlFor={domId}>
        {spec.label}
        <span className="field-requirement">{spec.required ? ' (required)' : ' (optional)'}</span>
      </label>
      <p className="field-help" id={helpId}>
        {spec.help}
      </p>
      {spec.kind === 'text' ||
      spec.kind === 'amount' ||
      spec.kind === 'currency' ||
      spec.kind === 'date' ? (
        <input
          {...common}
          type={spec.kind === 'date' ? 'date' : 'text'}
          inputMode={spec.kind === 'amount' ? 'decimal' : undefined}
          autoCapitalize={spec.kind === 'currency' ? 'characters' : undefined}
          maxLength={spec.maxLength * 4}
          onChange={changeHandler}
        />
      ) : (
        <textarea
          {...common}
          rows={spec.kind === 'list' ? 4 : 3}
          maxLength={spec.maxLength * 4}
          onChange={changeHandler}
        />
      )}
      {error !== undefined && (
        <p className="field-error" id={errorId}>
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}
