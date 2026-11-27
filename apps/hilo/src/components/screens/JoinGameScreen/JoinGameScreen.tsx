'use client';

import TabGroup from '@/components/TabGroup';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { LocalStorageKey } from '@/lib/constants';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormData, FormProvider, gameFormSchema } from './FormContext';
import { HostGameTabContent } from './HostGameTabContent';
import { JoinGameTabContent } from './JoinGameTabContent';

const TABS = [
  {
    id: 'join',
    label: 'Join game',
    Content: JoinGameTabContent,
  },
  {
    id: 'host',
    label: 'Host game',
    Content: HostGameTabContent,
  },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function JoinGameScreen() {
  const [activeTab, setActiveTab] = useState<TabId>('join');
  const Content = TABS.find((tab) => tab.id === activeTab)!.Content;
  const tabContentRef = useRef<HTMLFormElement>(null);
  const [storedName] = useLocalStorage(LocalStorageKey.PLAYER_NAME, '');

  const {
    register,
    formState: { errors, isSubmitted },
    watch,
    handleSubmit,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(gameFormSchema),
    mode: 'onSubmit',
    shouldUnregister: true,
    defaultValues: {
      name: storedName,
      roomCode: '',
      type: activeTab === 'host' ? 'hostGame' : 'joinGame',
    },
  });

  // Switching tabs resets the form so the new tab's schema applies.
  const changeTab = (tab: TabId) => {
    setActiveTab(tab);
    reset({ name: storedName, roomCode: '', type: tab === 'host' ? 'hostGame' : 'joinGame' });
  };

  // Whenever the active tab changes focus on the first input.
  useEffect(() => {
    const firstInput = tabContentRef.current?.querySelector('input:not([type="hidden"])');
    if (firstInput && firstInput instanceof HTMLElement) {
      firstInput.focus();
    }
  }, [activeTab]);

  return (
    <div className="h-dvh w-[var(--main-content-width)] mx-auto px-xs">
      <TabGroup tabs={TABS} activeTab={activeTab} onTabChange={changeTab}>
        <form
          ref={tabContentRef}
          className="h-full"
          autoComplete="off"
          onSubmit={(event) => {
            // Enter in a field presses the tab's main button.
            event.preventDefault();
            tabContentRef.current?.querySelector<HTMLButtonElement>('[data-submit]')?.click();
          }}
        >
          <FormProvider
            register={register}
            errors={errors}
            isSubmitted={isSubmitted}
            watch={watch}
            handleSubmit={handleSubmit}
            isHostTab={activeTab === 'host'}
          >
            {/* Hidden input to set the form type */}
            <input
              type="hidden"
              {...register('type')}
              value={activeTab === 'host' ? 'hostGame' : 'joinGame'}
            />
            <Content />
            {/* Lets Enter submit the form. */}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </FormProvider>
        </form>
      </TabGroup>
    </div>
  );
}
