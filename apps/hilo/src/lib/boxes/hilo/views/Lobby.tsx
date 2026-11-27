import Button from '@/components/Button';
import PlayerChip from '@/components/PlayerChip';
import {
  useActivePlayers,
  useChipProps,
  useGame,
  useGameHost,
  useIsGameHost,
  usePlayer,
  usePlayers,
  useRoomCode,
} from '@/lib/game/hooks';
import { gameAtom } from '@/lib/game/atoms';
import { trpc } from '@/lib/trpc';
import { serverMessage } from '@/lib/trpc/errors';
import { MAX_NUM_PLAYERS } from '@/shared/constants';
import { PlayerAvatarType } from '@/shared/types';
import { useSetAtom } from 'jotai';
import { ShareIcon, UserRoundPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Screen } from '../components/Screen';
import { TapToChange } from './TapToChange';

async function shareLink(roomCode: string) {
  const url = `${window.location.origin}/games/${roomCode}`;
  const shareData = { title: 'HILO', text: `Join my HILO game! Room code ${roomCode}`, url };
  try {
    if (navigator.share && navigator.canShare?.(shareData)) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch (error) {
    if ((error as Error).name !== 'AbortError') toast.error("Can't share the link");
  }
}

function useChangeAvatar() {
  const roomCode = useRoomCode();
  const game = useGame();
  const me = usePlayer();
  const setGame = useSetAtom(gameAtom);
  const mutation = trpc.game.updatePlayerAvatar.useMutation();

  const change = () => {
    if (!me) return;
    const current = game.playerAvatars[me.id];
    const taken = Object.entries(game.playerAvatars)
      .filter(([id]) => id !== me.id)
      .map(([, avatar]) => avatar);
    const all = Object.values(PlayerAvatarType);
    const start = Math.max(0, all.indexOf(current));
    const next = [...all.slice(start + 1), ...all.slice(0, start)].find((a) => !taken.includes(a));
    if (!next) return;

    // Update right away; the server confirms (or the snapshot puts it back).
    setGame((g) => g && { ...g, playerAvatars: { ...g.playerAvatars, [me.id]: next } });
    mutation.mutate(
      { roomCode, avatar: next },
      {
        onError: () =>
          setGame((g) => g && { ...g, playerAvatars: { ...g.playerAvatars, [me.id]: current } }),
      },
    );
  };
  return change;
}

export const Lobby = () => {
  const players = usePlayers();
  const activePlayers = useActivePlayers();
  const roomCode = useRoomCode();
  const me = usePlayer();
  const isGameHost = useIsGameHost();
  const host = useGameHost();
  const chipProps = useChipProps();
  const changeAvatar = useChangeAvatar();
  const startGameMutation = trpc.game.startGame.useMutation({
    onError: (error) => toast.error(serverMessage(error) ?? "Can't start the game"),
  });

  const numOpenSlots = Math.max(0, MAX_NUM_PLAYERS - players.length);
  const canStart = activePlayers.length >= 2;

  return (
    <Screen className="py-sm">
      <div className="flex items-center justify-between px-xs">
        <div className="flex items-center gap-xs">
          <div className="font-bold text-sm text-white shrink-0">Room code:</div>
          <Button
            variant="quiet"
            className="[&&]:py-xxs [&&]:px-sm [&&]:border-none"
            endIcon={<ShareIcon className="w-md h-md text-gray-400" />}
            textClassName="[&&]:text-sm [&&]:text-secondary tracking-[0.3em]"
            onClick={() => shareLink(roomCode)}
            aria-label={`Room code ${roomCode}. Share link`}
          >
            {roomCode}
          </Button>
        </div>
        <div className="text-sm text-white font-bold">hilo.trom.dev</div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-md px-xs">
        <div className="flex flex-wrap gap-xs">
          {players.map((player) => {
            const isMe = player.id === me?.id;
            const chip = (
              <PlayerChip
                {...chipProps(player)}
                tag={host?.id === player.id ? 'HOST' : undefined}
                onClick={isMe ? changeAvatar : undefined}
              />
            );
            return isMe ? (
              <TapToChange key={player.id}>{chip}</TapToChange>
            ) : (
              <span key={player.id}>{chip}</span>
            );
          })}
          {Array.from({ length: numOpenSlots }, (_, index) => (
            <PlayerChip key={index} />
          ))}
          <Button
            variant="quiet"
            className="[&&]:py-xxs [&&]:px-sm [&&]:border-gray-200"
            startIcon={<UserRoundPlus className="w-md h-md text-gray-200" />}
            textClassName="[&&]:text-sm [&&]:text-gray-200 [&&]:font-bold"
            onClick={() => shareLink(roomCode)}
          >
            Invite
          </Button>
        </div>

        <div className="rounded-sm bg-surface-container/60 p-sm text-sm text-gray-300 space-y-xxs">
          <p className="font-bold text-white">How to play</p>
          <p>
            Each round, one player asks a question with a number for an answer. Another player
            guesses the number.
          </p>
          <p>
            Everyone then bets whether the real answer is higher or lower. Right bets score 10
            points, and a close guess earns a bonus.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-xs mb-sm">
        {isGameHost() ? (
          <>
            <Button
              onClick={() => startGameMutation.mutate({ roomCode })}
              disabled={!canStart || startGameMutation.isPending}
            >
              {startGameMutation.isPending ? 'Starting...' : 'Start game'}
            </Button>
            {!canStart && <p className="text-sm text-gray-400">Invite at least one more player</p>}
          </>
        ) : (
          <div className="text-white text-sm font-bold">
            Waiting for {host?.name ?? 'the host'} to start the game
          </div>
        )}
      </div>
    </Screen>
  );
};
