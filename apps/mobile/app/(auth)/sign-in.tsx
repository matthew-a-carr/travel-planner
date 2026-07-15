import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiPost } from '../../src/api/client';
import { useAuth } from '../../src/auth/auth-context';
import { isE2eBuild, resolveBrowserLeg } from '../../src/auth/e2e-browser-leg';
import { generateVerifier, verifierToChallenge } from '../../src/auth/pkce';
import { runSignInFlow, type SignInPhase } from '../../src/auth/sign-in-flow';

/**
 * Sign-in screen — `/sign-in` (lives under the `(auth)` route group
 * per SPEC-007's restructure). Renders the "Sign in with Google"
 * button; on press, drives `runSignInFlow`, hands the returned
 * tokens to AuthProvider.signIn, and navigates to `/` (which lives
 * under the `(app)` group — the me screen).
 *
 * AuthGuard in the root layout would navigate automatically when
 * the auth state flips to signed_in, but we also call
 * `router.replace('/')` here as belt-and-braces in case the effect
 * lags by a frame.
 *
 * Three-state local discriminant — `idle` | `in_flight` | `error` —
 * keeps the UI mapping trivial. The OS browser modal covers the screen
 * during the bulk of the in-flight state, so finer-grained sub-states
 * (which API call is running) don't surface to the user.
 *
 * Two error buckets per SPEC-006 Q8:
 *  - `access_denied` → distinct closed-auth copy (user contacts admin).
 *  - everything else → generic "Sign-in failed. Try again." plus the
 *    underlying error code for debugging.
 */

type ScreenState =
  | { status: 'idle' }
  | { status: 'in_flight'; phase: SignInPhase | 'session' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };

export default function SignInScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [state, setState] = useState<ScreenState>({ status: 'idle' });

  const onSignInPress = async (): Promise<void> => {
    setState({ status: 'in_flight', phase: 'pkce' });
    try {
      const result = await runSignInFlow({
        apiPost,
        // Normal builds open Google in the system browser; the E2E build
        // (EXPO_PUBLIC_E2E_AUTH=1) substitutes the server test-auth seam so CI
        // can sign in without Google (SPEC-014). Everything else stays real.
        openAuthSession: resolveBrowserLeg(),
        generateVerifier,
        verifierToChallenge,
        onPhase: (phase) => setState({ status: 'in_flight', phase }),
      });

      if (result.status === 'success') {
        // Hand the tokens to AuthProvider — it persists, calls /me,
        // and transitions to signed_in (or rolls back to signed_out
        // on /me failure). AuthGuard navigates automatically when
        // state flips; the explicit replace below is belt-and-braces.
        setState({ status: 'in_flight', phase: 'session' });
        await auth.signIn(result.tokens);
        router.replace('/');
        return;
      }
      if (result.status === 'cancelled') {
        setState({ status: 'idle' });
        return;
      }
      setState({ status: 'error', reason: result.reason, code: result.code });
    } catch (error) {
      if (isE2eBuild()) {
        console.error('[mobile-e2e-auth] unexpected sign-in failure', error);
      }
      setState({ status: 'error', reason: 'generic', code: 'unexpected_client_error' });
    }
  };

  const disabled = state.status === 'in_flight';

  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}
      testID="login-screen-root"
    >
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSignInPress}
        style={{
          minHeight: 44,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
          backgroundColor: disabled ? '#cbd5e1' : '#0f172a',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
        testID="login-google-button"
      >
        {disabled ? <ActivityIndicator color="#ffffff" /> : null}
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
          Sign in with Google
        </Text>
      </Pressable>

      {state.status === 'error' ? (
        <View style={{ marginTop: 24, maxWidth: 320 }} testID="login-screen-error">
          <Text style={{ color: '#dc2626', fontSize: 14, textAlign: 'center' }}>
            {state.reason === 'access_denied'
              ? 'Sign-in is restricted. Ask the app admin to approve your account.'
              : `Sign-in failed. Try again. [code: ${state.code}]`}
          </Text>
        </View>
      ) : null}

      {isE2eBuild() && state.status === 'in_flight' ? (
        <Text style={{ marginTop: 12 }} testID="login-screen-phase">
          {state.phase}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
