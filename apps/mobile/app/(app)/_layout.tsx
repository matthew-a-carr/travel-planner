import { Stack } from 'expo-router';

/**
 * `(app)` route group — screens shown when the user is signed_in.
 * Me screen (at `/`) is the only member today. EPIC-002's trips
 * list will live alongside it. AuthGuard in the root layout owns
 * the redirect logic.
 */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
