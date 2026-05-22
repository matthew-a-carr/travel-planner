import { Stack } from 'expo-router';

/**
 * `(auth)` route group — screens shown when the user is signed_out.
 * Sign-in screen is the only member today. AuthGuard in the root
 * layout owns the redirect logic.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
