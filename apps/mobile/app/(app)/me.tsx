/**
 * Me screen — `/me` (lives under the `(app)` route group). The
 * milestone screen of EPIC-001; relocated from `/` in SPEC-011 when
 * the trips list took over the landing route. Reached via the trips
 * screen's profile button; a back control returns to the list.
 *
 * Renders `null` while auth.status is anything other than 'signed_in':
 *  - 'unknown' — cold-start in progress; native splash covers UI.
 *  - 'signed_out' — AuthGuard is about to navigate to /sign-in.
 *
 * Name fallback (Q5 in SPEC-007): when /me returns `name: null`,
 * the greeting becomes the generic "Hello!" and the email below
 * carries the identity instead of "Hello, mattcarr@example.com".
 *
 * Approval banner is defensive — bootstrap-admin sets isApproved=true
 * and authenticated /api/v1/* endpoints already enforce server-side,
 * but slice 7 surfaces the closed-auth story to the user.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/auth-context';

export default function MeScreen() {
  const auth = useAuth();
  const router = useRouter();
  if (auth.status !== 'signed_in') return null;

  const greeting = auth.me.name ? `Hello, ${auth.me.name}` : 'Hello!';

  return (
    <SafeAreaView style={styles.root} testID="me-screen-root">
      <Text style={styles.greeting} testID="me-screen-greeting">
        {greeting}
      </Text>
      <Text style={styles.email} testID="me-screen-email">
        {auth.me.email}
      </Text>
      {!auth.me.isApproved && (
        <Text style={styles.approvalBanner} testID="me-screen-approval-banner">
          Your account is pending approval.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.back();
        }}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        testID="me-screen-back"
      >
        <Text style={styles.backText}>Back to trips</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void auth.signOut();
        }}
        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        testID="me-screen-sign-out"
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '600',
    color: '#0f172a',
  },
  email: {
    fontSize: 16,
    fontWeight: '400',
    color: '#475569',
    marginTop: -12, // tighten the greeting/email pair
  },
  approvalBanner: {
    fontSize: 14,
    fontWeight: '500',
    color: '#b45309',
    textAlign: 'center',
    maxWidth: 280,
  },
  back: {
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    marginTop: 8,
  },
  backPressed: {
    backgroundColor: '#1e293b',
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  signOut: {
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginTop: 8,
  },
  signOutPressed: {
    backgroundColor: '#f1f5f9',
  },
  signOutText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '500',
  },
});
