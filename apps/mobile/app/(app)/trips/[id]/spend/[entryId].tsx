import { isoDateSchema, spendCategorySchema, type WireSpendCategory } from '@travel-planner/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../../src/auth/auth-context';
import {
  createMobileSpend,
  deleteMobileSpend,
  updateMobileSpend,
} from '../../../../../src/trips/spend-commands';
import { useTripDetail } from '../../../../../src/trips/use-trip-detail';
import { useTripFinancials } from '../../../../../src/trips/use-trip-financials';

const CATEGORIES = spendCategorySchema.options;
const today = () => new Date().toISOString().slice(0, 10);

export default function SpendEditorScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { id = '', entryId = 'new' } = useLocalSearchParams<{ id: string; entryId: string }>();
  const creating = entryId === 'new';
  const tripState = useTripDetail(id).state;
  const financialState = useTripFinancials(id).state;
  const destinations = tripState.status === 'loaded' ? tripState.trip.destinations : [];
  const existing =
    financialState.status === 'loaded'
      ? financialState.financials.entries.find((entry) => entry.id === entryId)
      : undefined;
  const initialized = useRef(false);
  const [destinationId, setDestinationId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<WireSpendCategory>('other');
  const [description, setDescription] = useState('');
  const [spentAt, setSpentAt] = useState(today());
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    if (creating && destinations[0]) {
      initialized.current = true;
      setDestinationId(destinations[0].id);
    } else if (!creating && existing) {
      initialized.current = true;
      setDestinationId(existing.destinationId);
      setAmount(String(existing.amount.amountPence / 100));
      setCategory(existing.category);
      setDescription(existing.description ?? '');
      setSpentAt(existing.spentAt);
    }
  }, [creating, destinations, existing]);

  if (auth.status !== 'signed_in') return null;

  const submit = async () => {
    const selectedDestination = destinationId || destinations[0]?.id;
    const amountPence = Math.round(Number.parseFloat(amount) * 100);
    if (!selectedDestination) return setError('Add a destination before recording spend.');
    if (!Number.isInteger(amountPence) || amountPence <= 0)
      return setError('Enter a valid amount.');
    if (!isoDateSchema.safeParse(spentAt).success) return setError('Enter a valid date.');
    if (description.trim().length > 500) return setError('Description is too long.');
    setPending(true);
    setError(null);
    const input = {
      amountPence,
      category,
      description: description.trim() || null,
      spentAt,
    };
    const result = creating
      ? await createMobileSpend(id, { destinationId: selectedDestination, ...input })
      : await updateMobileSpend(id, entryId, input);
    if (result.ok) router.replace(`/trips/${id}/finance`);
    else {
      setError(result.message);
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    const result = await deleteMobileSpend(id, entryId);
    if (result.ok) router.replace(`/trips/${id}/finance`);
    else {
      setError(result.message);
      setPending(false);
      setConfirmDelete(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="spend-editor-root">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.link}>‹ Spend</Text>
        </Pressable>
        <Text style={styles.title}>{creating ? 'Record spend' : 'Edit spend'}</Text>
      </View>
      {(creating || existing) && (
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {creating && (
            <>
              <Text style={styles.label}>Destination</Text>
              <View style={styles.options}>
                {destinations.map((destination) => (
                  <Pressable
                    accessibilityRole="button"
                    key={destination.id}
                    onPress={() => setDestinationId(destination.id)}
                    style={[styles.option, destinationId === destination.id && styles.selected]}
                    testID={`spend-destination-${destination.id}`}
                  >
                    <Text>{destination.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>Amount (GBP)</Text>
          <TextInput
            accessibilityLabel="Spend amount in pounds"
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="spend-amount"
            value={amount}
          />
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            accessibilityLabel="Spend date"
            onChangeText={setSpentAt}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="spend-date"
            value={spentAt}
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.options}>
            {CATEGORIES.map((value) => (
              <Pressable
                accessibilityRole="button"
                key={value}
                onPress={() => setCategory(value)}
                style={[styles.option, category === value && styles.selected]}
                testID={`spend-category-${value}`}
              >
                <Text>{value}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            accessibilityLabel="Spend description"
            maxLength={500}
            onChangeText={setDescription}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="spend-description"
            value={description}
          />
          {error && (
            <Text style={styles.error} testID="spend-error">
              {error}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => void submit()}
            style={styles.primary}
            testID="spend-submit"
          >
            <Text style={styles.primaryText}>
              {pending ? 'Saving…' : creating ? 'Record spend' : 'Save spend'}
            </Text>
          </Pressable>
          {!creating &&
            (!confirmDelete ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmDelete(true)}
                style={styles.danger}
                testID="spend-delete"
              >
                <Text style={styles.dangerText}>Delete spend</Text>
              </Pressable>
            ) : (
              <View style={styles.confirm} testID="spend-delete-warning">
                <Text>Delete this spend entry?</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void remove()}
                  style={styles.dangerSolid}
                  testID="spend-delete-confirm"
                >
                  <Text style={styles.primaryText}>Yes, delete</Text>
                </Pressable>
              </View>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, gap: 8 },
  link: { minHeight: 44, color: '#0369a1', fontSize: 17 },
  title: { fontSize: 26, fontWeight: '700' },
  form: { padding: 20, gap: 10 },
  label: { fontWeight: '600', color: '#334155' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
  },
  selected: { backgroundColor: '#e2e8f0', borderColor: '#0f172a' },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  danger: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
  },
  dangerText: { color: '#b91c1c', fontWeight: '600' },
  dangerSolid: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b91c1c',
    borderRadius: 8,
  },
  confirm: { padding: 12, gap: 10, backgroundColor: '#fff1f2', borderRadius: 8 },
  error: { color: '#b91c1c' },
});
