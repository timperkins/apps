import classNames from 'classnames';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  textClassName?: string;
  /** primary: green, action: blue, quiet: dark */
  variant?: 'primary' | 'action' | 'quiet';
}

const variants = {
  primary: 'bg-primary hover:bg-primary/85 border-md border-white',
  action: 'bg-action hover:bg-action/85 border-md border-white',
  quiet: 'bg-dark hover:bg-dark/80 border-sm border-gray-500',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      startIcon,
      endIcon,
      className,
      textClassName,
      onClick,
      variant = 'primary',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        {...props}
        className={classNames(
          'py-sm px-xl rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-xs select-none',
          variants[variant],
          onClick || type === 'submit' ? 'cursor-pointer' : 'cursor-default',
          className,
        )}
      >
        {startIcon && <span className="flex">{startIcon}</span>}
        {children !== undefined && (
          <span className={classNames('text-md font-black text-white', textClassName)}>
            {children}
          </span>
        )}
        {endIcon && <span className="flex">{endIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
