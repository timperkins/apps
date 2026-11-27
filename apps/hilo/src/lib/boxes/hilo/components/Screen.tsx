import classNames from 'classnames';
import { ReactNode } from 'react';

/** Full-height phone-width column. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        'min-h-dvh w-[var(--main-content-width)] mx-auto flex flex-col px-xxs',
        className,
      )}
    >
      {children}
    </div>
  );
}
