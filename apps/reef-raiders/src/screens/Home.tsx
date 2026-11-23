import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { unlockAudio } from '../audio/sound';
import { isValidCode, normalizeCode } from '../net/codes';
import { ensureUser } from '../net/firebase';
import { createRoom } from '../net/rooms';

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async (solo = false) => {
    // This click is the display's first gesture, so it also unlocks sound for the game.
    unlockAudio();
    setBusy(true);
    setError('');
    try {
      const user = await ensureUser();
      const room = await createRoom(user.uid);
      navigate(solo ? `/host/${room}?solo` : `/host/${room}`);
    } catch (err) {
      console.error(err);
      setError('Could not create a game. Check your connection and try again.');
      setBusy(false);
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (isValidCode(code)) navigate(`/play/${code}`);
  };

  return (
    <main className="screen">
      <h1 className="title">Reef Raiders</h1>
      <button className="primary wide" onClick={() => create()} disabled={busy}>
        {busy ? 'Creating…' : 'New game'}
      </button>
      <p className="dim small">Shows the sea on this screen. Players join with their phones as pirates or fish.</p>
      <button className="wide" onClick={() => create(true)} disabled={busy}>
        Play solo
      </button>
      <p className="dim small">Play on this phone or computer against an easy bot. Friends can still join.</p>
      <form className="row" onSubmit={join}>
        <input
          className="code-input"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="CODE"
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          aria-label="Room code"
        />
        <button type="submit" disabled={!isValidCode(code)}>
          Join
        </button>
      </form>
      {error && <p>{error}</p>}
    </main>
  );
}
