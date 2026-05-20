import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Placeholder post-sign-in screen for SPEC-006 / slice 6. Renders the
 * authenticated user's email so the sign-in flow has an observable
 * landing point. Slice 7 will swap this for the proper "Hello,
 * {name}" home screen with the avatar + sign-out affordance.
 */
export default function SignedInScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();

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
