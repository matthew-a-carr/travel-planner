import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
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
 *
 * The redirect is gated on `useRootNavigationState().key`: a
 * `router.replace(...)` issued before the root navigator has mounted is
 * silently dropped, which would strand the cold-start on the null
 * MeScreen (splash already hidden, no sign-in screen) — the exact
 * stuck state the `sign-in` Maestro flow timed out on. We also hold the
 * splash until the navigator is ready so there's no flash of the null
 * screen before the redirect lands.
 */
function AuthGuard({ children }: PropsWithChildren) {
  const auth = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (auth.status === 'unknown') return; // still booting; hold splash
    if (!navigationState?.key) return; // navigator not mounted yet; hold splash
    void SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    if (auth.status === 'signed_in' && inAuthGroup) {
      router.replace('/');
    } else if (auth.status === 'signed_out' && !inAuthGroup) {
      router.replace('/sign-in');
    }
  }, [auth.status, segments, router, navigationState?.key]);

  return <>{children}</>;
}
