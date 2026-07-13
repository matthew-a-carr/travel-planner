import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/auth/auth-context';
import { createMobileTrip } from '../../../src/trips/trip-commands';
import { useOrganizations } from '../../../src/trips/use-organizations';

export default function NewTripScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { state: organizationsState, reload } = useOrganizations();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationsState.status === 'loaded' && !organizationId) {
      setOrganizationId(organizationsState.organizations[0]?.id ?? '');
    }
  }, [organizationId, organizationsState]);

  if (auth.status !== 'signed_in') return null;

  const submit = async () => {
    const trimmedName = name.trim();
    const totalBudgetPence = Math.round(Number.parseFloat(budget) * 100);
    if (!organizationId) {
      setError('Choose an organization.');
      return;
    }
    if (!trimmedName) {
      setError('Trip name is required.');
      return;
    }
    if (!Number.isInteger(totalBudgetPence) || totalBudgetPence <= 0) {
      setError('Enter a valid budget greater than zero.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createMobileTrip({ organizationId, name: trimmedName, totalBudgetPence });
    if (result.ok) {
      router.replace(`/trips/${result.data.id}`);
      return;
    }
    setError(result.message);
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.root} testID="trip-create-root">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="trip-create-back">
          <Text style={styles.back}>‹ Trips</Text>
        </Pressable>
        <Text style={styles.title}>New trip</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Organization</Text>
        {organizationsState.status === 'loading' && <ActivityIndicator />}
        {organizationsState.status === 'error' && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{organizationsState.message}</Text>
            <Pressable onPress={reload}>
              <Text style={styles.link}>Retry</Text>
            </Pressable>
          </View>
        )}
        {organizationsState.status === 'loaded' &&
          organizationsState.organizations.length === 0 && (
            <Text style={styles.help}>Join or create an organization on the web app first.</Text>
          )}
        {organizationsState.status === 'loaded' &&
          organizationsState.organizations.map((organization) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: organizationId === organization.id }}
              key={organization.id}
              onPress={() => setOrganizationId(organization.id)}
              style={[styles.choice, organizationId === organization.id && styles.choiceSelected]}
              testID={`trip-create-organization-${organization.id}`}
            >
              <Text style={styles.choiceText}>{organization.name}</Text>
            </Pressable>
          ))}

        <Text style={styles.label}>Trip name</Text>
        <TextInput
          autoCapitalize="words"
          editable={!submitting}
          onChangeText={setName}
          placeholder="Japan 2027"
          style={styles.input}
          testID="trip-create-name"
          value={name}
        />
        <Text style={styles.label}>Total budget (GBP)</Text>
        <TextInput
          editable={!submitting}
          keyboardType="decimal-pad"
          onChangeText={setBudget}
          placeholder="5000"
          style={styles.input}
          testID="trip-create-budget"
          value={budget}
        />
        {error && (
          <Text style={styles.errorText} testID="trip-create-error">
            {error}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void submit()}
          style={[styles.submit, submitting && styles.disabled]}
          testID="trip-create-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Create trip</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, gap: 8 },
  back: { fontSize: 17, color: '#0f172a', minHeight: 44 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  label: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#334155' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  choiceSelected: { borderColor: '#0f172a', backgroundColor: '#e2e8f0' },
  choiceText: { color: '#0f172a', fontSize: 16 },
  help: { color: '#64748b', fontSize: 14 },
  errorBlock: { gap: 8 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  link: { color: '#0f172a', fontWeight: '600' },
  submit: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
