import { GameScreen } from '@/components/screens/GameScreen';
import { use } from 'react';

interface GamePageProps {
  params: Promise<{ code: string }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { code } = use(params);
  const roomCode = code.toUpperCase();

  // Keyed by room so moving to a new game ("Play again") joins it from scratch.
  return <GameScreen key={roomCode} roomCode={roomCode} />;
}
