import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/auth-context';

/**
 * Placeholder post-sign-in screen — bridging Phase C of SPEC-007.
 * Reads identity from AuthProvider (was: from search params in
 * SPEC-006). Phase D restructures routes and replaces this with
 * the real me screen at `app/(app)/index.tsx`.
 */
export default function SignedInScreen() {
  const auth = useAuth();

  const email = auth.status === 'signed_in' ? auth.me.email : '…';

  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      testID="signed-in-screen-root"
    >
      <Text style={{ fontSize: 20, fontWeight: '500' }} testID="signed-in-screen-email">
        {`Signed in as ${email}.`}
      </Text>
    </SafeAreaView>
  );
}
