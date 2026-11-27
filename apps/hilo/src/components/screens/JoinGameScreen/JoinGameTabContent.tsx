import Button from '@/components/Button';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FormData, isJoinGameForm, useFormContext } from './FormContext';
import { NameTextField } from './NameTextField';
import { RoomCodeTextField } from './RoomCodeTextField';

export const JoinGameTabContent = () => {
  const router = useRouter();
  const { handleSubmit } = useFormContext();
  const verifyGameMutation = trpc.game.verifyGame.useMutation();

  const onSubmit = async (data: FormData) => {
    // Type guard ensures we have the correct form data
    if (!isJoinGameForm(data)) {
      console.error('Invalid form data for join game');
      return;
    }

    try {
      const result = await verifyGameMutation.mutateAsync({
        roomCode: data.roomCode.trim(),
      });
      if (result.verified) {
        router.push(`/games/${data.roomCode.trim()}`);
      } else {
        throw new Error('Game not verified');
      }
    } catch (err) {
      console.error(err);
      toast.error('Game not found');
    }
  };

  return (
    <div className="flex flex-col h-[min(100%,80vw)] justify-around items-center">
      <RoomCodeTextField disabled={verifyGameMutation.isPending} />
      <NameTextField disabled={verifyGameMutation.isPending} />
      <Button
        data-submit
        className="mt-sm"
        onClick={handleSubmit(onSubmit)}
        disabled={verifyGameMutation.isPending}
      >
        {verifyGameMutation.isPending ? 'Joining...' : 'Join game'}
      </Button>
    </div>
  );
};
