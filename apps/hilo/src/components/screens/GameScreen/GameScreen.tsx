'use client';

import Button from '@/components/Button';
import Frog from '@/components/Frog';
import TextField from '@/components/TextField';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { LocalStorageKey } from '@/lib/constants';
import { GameProvider } from '@/lib/game/GameProvider';
import { trpc } from '@/lib/trpc';
import { appErrorCode } from '@/lib/trpc/errors';
import { NAME_MAX_LENGTH } from '@/shared/constants';
import { AppErrorCode } from '@/shared/types';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

/** For players who open an invite link before they've picked a name. */
function NameForm({ roomCode, onName }: { roomCode: string; onName: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  return (
    <form
      className="min-h-dvh w-[var(--main-content-width)] mx-auto flex flex-col items-center justify-center gap-md px-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
          setError('Name is required');
          return;
        }
        onName(trimmed);
      }}
    >
      <Frog className="w-[calc(6rem*var(--scale))] h-[calc(6rem*var(--scale))]" />
      <p className="text-md font-bold">
        Joining room <span className="tracking-[0.2em] text-secondary">{roomCode}</span>
      </p>
      <TextField
        id="name"
        label="Your name"
        className="w-full"
        autoFocus
        spellCheck={false}
        maxLength={NAME_MAX_LENGTH}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        error={error}
      />
      <Button type="submit">Join game</Button>
    </form>
  );
}

export const GameScreen = ({ roomCode }: { roomCode: string }) => {
  const router = useRouter();
  const [playerName, setPlayerName] = useLocalStorage(LocalStorageKey.PLAYER_NAME, '');
  const joinGameMutation = trpc.game.joinGame.useMutation({
    onError: (error) => {
      console.error('Join game error:', error);
      switch (appErrorCode(error)) {
        case AppErrorCode.GAME_NOT_FOUND:
          toast.error('Game not found');
          break;
        case AppErrorCode.GAME_FULL:
          toast.error('That game is full');
          break;
        default:
          toast.error("Can't join game");
      }
      router.replace('/');
    },
  });
  const joinedNameRef = useRef<string>(undefined);
  const { mutate } = joinGameMutation;

  // Joining is idempotent, so a rejoin (refresh, reconnect) just picks up where the player left off.
  useEffect(() => {
    const name = playerName?.trim();
    if (!name || joinedNameRef.current === name) return;
    joinedNameRef.current = name;
    mutate({ roomCode, playerName: name });
  }, [playerName, roomCode, mutate]);

  if (!playerName?.trim()) {
    return <NameForm roomCode={roomCode} onName={setPlayerName} />;
  }

  return joinGameMutation.isSuccess ? <GameProvider roomCode={roomCode} /> : null;
};
