import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiPost } from '../src/api/client';
import { useAuth } from '../src/auth/auth-context';
import { generateVerifier, verifierToChallenge } from '../src/auth/pkce';
import { runSignInFlow } from '../src/auth/sign-in-flow';

/**
 * Sign-in screen for SPEC-006. Renders the "Sign in with Google"
 * button; on press, drives `runSignInFlow` with the production deps
 * and navigates to `/signed-in` on success.
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
  | { status: 'in_flight' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };

export default function SignInScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [state, setState] = useState<ScreenState>({ status: 'idle' });

  const onSignInPress = async (): Promise<void> => {
    setState({ status: 'in_flight' });
    const result = await runSignInFlow({
      apiPost,
      openAuthSession: WebBrowser.openAuthSessionAsync,
      generateVerifier,
      verifierToChallenge,
    });

    if (result.status === 'success') {
      // Hand the tokens to AuthProvider — it persists, calls /me,
      // and transitions to signed_in (or rolls back to signed_out on
      // /me failure). Then navigate to the placeholder; Phase D will
      // restructure routes so this becomes /(app)/.
      await auth.signIn(result.tokens);
      router.replace('/signed-in');
      return;
    }
    if (result.status === 'cancelled') {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'error', reason: result.reason, code: result.code });
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
    </SafeAreaView>
  );
}
