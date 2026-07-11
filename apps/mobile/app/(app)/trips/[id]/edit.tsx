import type { WireTripStatus } from '@travel-planner/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { useAuth } from '../../../../src/auth/auth-context';
import { deleteMobileTrip, updateMobileTrip } from '../../../../src/trips/trip-commands';
import { useTripDetail } from '../../../../src/trips/use-trip-detail';

const STATUSES: readonly WireTripStatus[] = ['planning', 'active', 'completed'];

export default function EditTripScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { state, reload } = useTripDetail(id);
  const initializedId = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<WireTripStatus>('planning');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loaded' && initializedId.current !== state.trip.id) {
      initializedId.current = state.trip.id;
      setName(state.trip.name);
      setBudget(String(state.trip.totalBudget.amountPence / 100));
      setStatus(state.trip.status);
    }
  }, [state]);

  if (auth.status !== 'signed_in') return null;

  const submit = async () => {
    const trimmedName = name.trim();
    const totalBudgetPence = Math.round(Number.parseFloat(budget) * 100);
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
    const result = await updateMobileTrip(id, { name: trimmedName, totalBudgetPence, status });
    if (result.ok) {
      router.replace(`/trips/${id}`);
      return;
    }
    setError(result.message);
    setSubmitting(false);
  };

  const remove = async () => {
    setSubmitting(true);
    setError(null);
    const result = await deleteMobileTrip(id);
    if (result.ok) {
      router.replace('/');
      return;
    }
    setError(result.message);
    setSubmitting(false);
    setConfirmDelete(false);
  };

  return (
    <SafeAreaView style={styles.root} testID="trip-edit-root">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="trip-edit-back">
          <Text style={styles.back}>‹ Trip</Text>
        </Pressable>
        <Text style={styles.title}>Edit trip</Text>
      </View>
      {state.status === 'loading' && <ActivityIndicator testID="trip-edit-loading" />}
      {state.status === 'not_found' && <Text style={styles.message}>Trip not found.</Text>}
      {state.status === 'error' && (
        <View style={styles.messageBlock}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable onPress={reload}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      )}
      {state.status === 'loaded' && (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Trip name</Text>
          <TextInput
            editable={!submitting}
            onChangeText={setName}
            style={styles.input}
            testID="trip-edit-name"
            value={name}
          />
          <Text style={styles.label}>Total budget (GBP)</Text>
          <TextInput
            editable={!submitting}
            keyboardType="decimal-pad"
            onChangeText={setBudget}
            style={styles.input}
            testID="trip-edit-budget"
            value={budget}
          />
          <Text style={styles.label}>Status</Text>
          <View style={styles.statuses}>
            {STATUSES.map((value) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: status === value }}
                key={value}
                onPress={() => setStatus(value)}
                style={[styles.status, status === value && styles.statusSelected]}
                testID={`trip-edit-status-${value}`}
              >
                <Text style={styles.statusText}>
                  {value[0]?.toUpperCase()}
                  {value.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
          {error && (
            <Text style={styles.errorText} testID="trip-edit-error">
              {error}
            </Text>
          )}
          <Pressable
            disabled={submitting}
            onPress={() => void submit()}
            style={styles.submit}
            testID="trip-edit-submit"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Save changes</Text>
            )}
          </Pressable>
          {!confirmDelete ? (
            <Pressable
              disabled={submitting}
              onPress={() => setConfirmDelete(true)}
              style={styles.delete}
              testID="trip-edit-delete"
            >
              <Text style={styles.deleteText}>Delete trip</Text>
            </Pressable>
          ) : (
            <View style={styles.confirm} testID="trip-edit-delete-warning">
              <Text style={styles.errorText}>Delete this trip and all of its travel data?</Text>
              <Pressable
                disabled={submitting}
                onPress={() => void remove()}
                style={styles.deleteSolid}
                testID="trip-edit-delete-confirm"
              >
                <Text style={styles.submitText}>Yes, delete trip</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmDelete(false)} testID="trip-edit-delete-cancel">
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
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
  statuses: { flexDirection: 'row', gap: 8 },
  status: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSelected: { borderColor: '#0f172a', backgroundColor: '#e2e8f0' },
  statusText: { color: '#0f172a', fontSize: 14 },
  submit: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  delete: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteSolid: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: { color: '#b91c1c', fontSize: 16, fontWeight: '600' },
  confirm: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  message: { padding: 20, color: '#475569' },
  messageBlock: { padding: 20, gap: 8 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  link: { color: '#0f172a', fontWeight: '600' },
});
