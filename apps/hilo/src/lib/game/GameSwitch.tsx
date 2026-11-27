import { HiloGame } from '@/lib/boxes/hilo/HiloGame';
import { GameBox } from '@/shared/types';
import { useGameBox } from './hooks/useGameBox';

export function GameSwitch() {
  const gameBox = useGameBox();

  switch (gameBox) {
    case GameBox.HILO:
      return <HiloGame />;
    default:
      return null;
  }
}
