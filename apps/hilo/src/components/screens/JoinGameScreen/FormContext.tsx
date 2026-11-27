'use client';

import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@/shared/constants';
import { createContext, ReactNode, useContext } from 'react';
import { FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormWatch } from 'react-hook-form';
import { z } from 'zod';

const nameInputSchema = z
  .string()
  .min(1, 'Name is required')
  .max(NAME_MAX_LENGTH, `Name must be ${NAME_MAX_LENGTH} characters or less`)
  .refine((value) => value && value.trim().length > 0, 'Name cannot be empty');

const roomCodeInputSchema = z
  .string()
  .min(1, 'Room code is required')
  .length(ROOM_CODE_LENGTH, `Room code must be exactly ${ROOM_CODE_LENGTH} characters`);

export const joinGameSchema = z.object({
  name: nameInputSchema,
  roomCode: roomCodeInputSchema,
  type: z.literal('joinGame'),
});

export const hostGameSchema = z.object({
  name: nameInputSchema,
  type: z.literal('hostGame'),
});

export const gameFormSchema = z.discriminatedUnion('type', [joinGameSchema, hostGameSchema]);

export type FormData = z.infer<typeof gameFormSchema>;
export type JoinFormData = z.infer<typeof joinGameSchema>;
export type HostFormData = z.infer<typeof hostGameSchema>;

export const isJoinGameForm = (data: FormData): data is JoinFormData => {
  return data.type === 'joinGame';
};

export const isHostGameForm = (data: FormData): data is HostFormData => {
  return data.type === 'hostGame';
};

interface FormContextType {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  isSubmitted: boolean;
  watch: UseFormWatch<FormData>;
  handleSubmit: UseFormHandleSubmit<FormData>;
  isHostTab: boolean;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

interface FormProviderProps {
  children: ReactNode;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  isSubmitted: boolean;
  watch: UseFormWatch<FormData>;
  handleSubmit: UseFormHandleSubmit<FormData>;
  isHostTab: boolean;
}

export const FormProvider = ({
  children,
  register,
  errors,
  isSubmitted,
  watch,
  handleSubmit,
  isHostTab,
}: FormProviderProps) => {
  return (
    <FormContext.Provider value={{ register, errors, isSubmitted, watch, handleSubmit, isHostTab }}>
      {children}
    </FormContext.Provider>
  );
};

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
};
