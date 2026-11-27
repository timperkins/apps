'use client';

import useWindowDimensions from '@/hooks/useWindowDimensions';
import { ToastBar, Toaster as ToasterBase } from 'react-hot-toast';

export default function Toaster() {
  const { height } = useWindowDimensions();
  const gutter = height ? height * 0.02 : 10;

  return (
    <>
      <ToasterBase
        position="top-center"
        containerStyle={{
          top: 'var(--spacing-sm)',
        }}
        toastOptions={{
          className: 'text-sm font-bold !max-w-[90vw]',
          style: {
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            borderRadius: 'var(--radius-sm)',
          },
        }}
        gutter={gutter}
      >
        {(toast) => (
          <ToastBar toast={toast}>
            {({ icon, message }) => (
              <>
                <div className="scale-[var(--scale)]">{icon}</div>
                <div className="[&>*]:!m-0 ml-[calc(var(--spacing-xs)*var(--scale))]">
                  {message}
                </div>
              </>
            )}
          </ToastBar>
        )}
      </ToasterBase>
    </>
  );
}
