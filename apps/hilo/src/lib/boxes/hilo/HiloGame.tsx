import { useCurrentRound, useGameState } from '@/lib/game/hooks';
import { HiLoRoundStage } from '@/shared/boxes/hilo/types';
import { GameState } from '@/shared/types';
import { AnswerQuestion } from './stages/AnswerQuestion';
import { AskQuestion } from './stages/AskQuestion';
import { MoreOrLess } from './stages/MoreOrLess';
import { Scoreboard } from './stages/Scoreboard';
import { Final } from './views/Final';
import { Lobby } from './views/Lobby';

function CurrentRound() {
  const round = useCurrentRound();
  switch (round?.data.activeStage) {
    case HiLoRoundStage.AskQuestion:
      return <AskQuestion key={round.round} />;
    case HiLoRoundStage.AnswerQuestion:
      return <AnswerQuestion key={round.round} />;
    case HiLoRoundStage.MoreOrLess:
      return <MoreOrLess key={round.round} />;
    case HiLoRoundStage.Scoreboard:
      return <Scoreboard key={round.round} />;
    default:
      return null;
  }
}

export function HiloGame() {
  switch (useGameState()) {
    case GameState.NOT_STARTED:
      return <Lobby />;
    case GameState.IN_PROGRESS:
      return <CurrentRound />;
    case GameState.ENDED:
      return <Final />;
  }
}
