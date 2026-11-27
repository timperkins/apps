'use client';

import TextField, { TextFieldProps } from '@/components/TextField';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { LocalStorageKey } from '@/lib/constants';
import { NAME_MAX_LENGTH } from '@/shared/constants';
import { useEffect } from 'react';
import { useFormContext } from './FormContext';

export const NameTextField = (props: Partial<TextFieldProps>) => {
  const { register, errors, isSubmitted, watch } = useFormContext();
  const [, setName] = useLocalStorage(LocalStorageKey.PLAYER_NAME, '');

  const watchedName = watch('name');

  useEffect(() => {
    setName(watchedName);
  }, [watchedName, setName]);

  return (
    <TextField
      label="Your name"
      className="w-full"
      id="name"
      type="text"
      spellCheck={false}
      maxLength={NAME_MAX_LENGTH}
      {...register('name')}
      error={isSubmitted && errors.name ? errors.name.message : undefined}
      {...props}
    />
  );
};
