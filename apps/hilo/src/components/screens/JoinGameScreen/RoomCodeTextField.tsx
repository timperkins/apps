'use client';

import TextField, { TextFieldProps } from '@/components/TextField';
import { ROOM_CODE_LENGTH } from '@/shared/constants';
import { isJoinGameForm, useFormContext } from './FormContext';

export const RoomCodeTextField = (props: Partial<TextFieldProps>) => {
  const { register, errors, isSubmitted, watch } = useFormContext();
  const formData = watch();

  const isJoinGame = isJoinGameForm(formData);
  const roomCodeError = isJoinGame && 'roomCode' in errors ? errors.roomCode : undefined;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const transformedValue = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    e.target.value = transformedValue;
  };

  const { onChange: registerOnChange, ...registerProps } = register('roomCode');

  return (
    <TextField
      label="Room code"
      className="w-full"
      id="roomCode"
      type="text"
      spellCheck={false}
      maxLength={ROOM_CODE_LENGTH}
      {...registerProps}
      onChange={(e) => {
        handleInputChange(e);
        registerOnChange(e);
      }}
      error={isSubmitted && roomCodeError ? roomCodeError.message : undefined}
      {...props}
    />
  );
};
