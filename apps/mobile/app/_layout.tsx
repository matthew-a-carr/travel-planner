import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type PropsWithChildren, useEffect } from 'react';
import { AuthProvider, useAuth } from '../src/auth/auth-context';

// Hold the native splash until the cold-start auth check resolves —
// avoids a flash of either screen before AuthGuard makes its decision.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGuard>
    </AuthProvider>
  );
}

/**
 * Canonical Expo Router auth-guard pattern:
 * https://docs.expo.dev/router/reference/authentication/
 *
 * `useSegments()` reports the active route's group prefix. If the
 * auth state and the current group disagree (signed_in but in
 * (auth)/, or signed_out but in (app)/), navigate to the right
 * group. The first render of the initial route is `(app)/` (URL `/`)
 * — MeScreen renders null while `auth.status === 'unknown'`, so the
 * native splash covers the UI until this effect resolves the state
 * and either keeps the user on `/` (signed_in) or redirects to
 * `/sign-in` (signed_out).
 */
function AuthGuard({ children }: PropsWithChildren) {
  const auth = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'unknown') return; // still booting; hold splash
    void SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    if (auth.status === 'signed_in' && inAuthGroup) {
      router.replace('/');
    } else if (auth.status === 'signed_out' && !inAuthGroup) {
      router.replace('/sign-in');
    }
  }, [auth.status, segments, router]);

  return <>{children}</>;
}
