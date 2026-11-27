import Button from '@/components/Button';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { FormData, isHostGameForm, useFormContext } from './FormContext';
import { NameTextField } from './NameTextField';

export const HostGameTabContent = () => {
  const router = useRouter();
  const { handleSubmit, errors } = useFormContext();
  const createGameMutation = trpc.game.create.useMutation();

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.error(errors);
    }
  }, [errors]);

  const onSubmit = async (data: FormData) => {
    // Type guard ensures we have the correct form data
    if (!isHostGameForm(data)) {
      console.error('Invalid form data for host game');
      return;
    }

    try {
      const result = await createGameMutation.mutateAsync();
      if (result.success) {
        router.push(`/games/${result.roomCode}`);
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      toast.error("Can't create game");
    }
  };

  return (
    <div className="flex flex-col h-[min(50%,50vw)] justify-around items-center">
      <NameTextField disabled={createGameMutation.isPending} />
      <Button
        data-submit
        onClick={handleSubmit(onSubmit)}
        className="mt-sm"
        disabled={createGameMutation.isPending}
      >
        {createGameMutation.isPending ? 'Loading...' : 'Host game'}
      </Button>
    </div>
  );
};
