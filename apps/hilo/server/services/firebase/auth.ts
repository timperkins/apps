import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { app } from './firebase';

export async function getUID(idToken: string): Promise<string> {
  const decodedToken = await getAuth(app).verifyIdToken(idToken);
  return decodedToken.uid;
}
