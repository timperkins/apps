import classNames from 'classnames';
import Input, { InputProps } from './Input';

export interface TextFieldProps extends Omit<InputProps, 'error'> {
  label: string;
  error?: string;
}

export default function TextField({ label, error, className, ...inputProps }: TextFieldProps) {
  return (
    <div className={classNames('space-y-xxs', className)}>
      <label htmlFor={inputProps.id} className="block text-sm font-bold">
        {label}
      </label>
      <Input {...inputProps} error={!!error} />
      <div className="h-sm">{error && <p className="text-sm text-red-600">{error}</p>}</div>
    </div>
  );
}
