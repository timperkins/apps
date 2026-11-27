import classNames from 'classnames';
import { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <input
      {...props}
      ref={ref}
      // Prevent autofill in Chrome.
      autoComplete="new-password"
      className={classNames(
        'w-full px-sm py-sm rounded-sm shadow-sm text-white focus:outline-none focus:[box-shadow:0_0_0_var(--spacing-xxxs)_var(--tw-ring-color)] disabled:opacity-50 transition-colors text-md font-bold bg-surface-container',
        error
          ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 focus:ring-secondary focus:border-secondary',
        className,
      )}
    />
  );
});

Input.displayName = 'Input';

export default Input;
