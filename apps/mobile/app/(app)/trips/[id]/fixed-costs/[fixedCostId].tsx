import { fixedCostCategorySchema, type WireFixedCostCategory } from '@travel-planner/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../../src/auth/auth-context';
import {
  createMobileFixedCost,
  deleteMobileFixedCost,
  updateMobileFixedCost,
} from '../../../../../src/trips/planning-commands';
import { useTripDetail } from '../../../../../src/trips/use-trip-detail';

const CATEGORIES = fixedCostCategorySchema.options;
const today = () => new Date().toISOString().slice(0, 10);

export default function FixedCostEditorScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { id = '', fixedCostId = 'new' } = useLocalSearchParams<{
    id: string;
    fixedCostId: string;
  }>();
  const creating = fixedCostId === 'new';
  const { state } = useTripDetail(id);
  const existing =
    state.status === 'loaded'
      ? state.trip.fixedCosts.find((item) => item.id === fixedCostId)
      : undefined;
  const initialized = useRef(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<WireFixedCostCategory>('other');
  const [date, setDate] = useState(today());
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!creating && existing && !initialized.current) {
      initialized.current = true;
      setLabel(existing.label);
      setAmount(String(existing.amount.amountPence / 100));
      setCategory(existing.category);
      setDate(existing.date);
    }
  }, [creating, existing]);
  if (auth.status !== 'signed_in') return null;
  const submit = async () => {
    const amountPence = Math.round(Number.parseFloat(amount) * 100);
    if (!label.trim()) return setError('Label is required.');
    if (!Number.isInteger(amountPence) || amountPence <= 0)
      return setError('Enter a valid amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter a valid date.');
    setPending(true);
    setError(null);
    const input = { label: label.trim(), amountPence, category, date };
    const result = creating
      ? await createMobileFixedCost(id, input)
      : await updateMobileFixedCost(id, fixedCostId, input);
    if (result.ok) router.replace(`/trips/${id}`);
    else {
      setError(result.message);
      setPending(false);
    }
  };
  const remove = async () => {
    setPending(true);
    const result = await deleteMobileFixedCost(id, fixedCostId);
    if (result.ok) router.replace(`/trips/${id}`);
    else {
      setError(result.message);
      setPending(false);
      setConfirmDelete(false);
    }
  };
  return (
    <SafeAreaView style={styles.root} testID="fixed-cost-editor-root">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>‹ Trip</Text>
        </Pressable>
        <Text style={styles.title}>{creating ? 'Add fixed cost' : 'Edit fixed cost'}</Text>
      </View>
      {(creating || existing) && (
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Label</Text>
          <TextInput
            accessibilityLabel="Fixed cost label"
            value={label}
            onChangeText={setLabel}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="fixed-cost-label"
          />
          <Text style={styles.label}>Amount (GBP)</Text>
          <TextInput
            accessibilityLabel="Fixed cost amount in pounds"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="fixed-cost-amount"
          />
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            accessibilityLabel="Fixed cost date"
            value={date}
            onChangeText={setDate}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="fixed-cost-date"
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((value) => (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                style={[styles.option, category === value && styles.selected]}
                testID={`fixed-cost-category-${value}`}
              >
                <Text>{value}</Text>
              </Pressable>
            ))}
          </View>
          {error && (
            <Text style={styles.error} testID="fixed-cost-error">
              {error}
            </Text>
          )}
          <Pressable
            disabled={pending}
            onPress={() => void submit()}
            style={styles.primary}
            testID="fixed-cost-submit"
          >
            <Text style={styles.primaryText}>
              {pending ? 'Saving…' : creating ? 'Add fixed cost' : 'Save fixed cost'}
            </Text>
          </Pressable>
          {!creating &&
            (!confirmDelete ? (
              <Pressable
                onPress={() => setConfirmDelete(true)}
                style={styles.danger}
                testID="fixed-cost-delete"
              >
                <Text style={styles.dangerText}>Delete fixed cost</Text>
              </Pressable>
            ) : (
              <View style={styles.confirm} testID="fixed-cost-delete-warning">
                <Text>Delete this fixed cost?</Text>
                <Pressable
                  onPress={() => void remove()}
                  style={styles.dangerSolid}
                  testID="fixed-cost-delete-confirm"
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
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
