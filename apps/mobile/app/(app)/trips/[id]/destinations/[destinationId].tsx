import type { WireComfortLevel } from '@travel-planner/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../../src/auth/auth-context';
import {
  createMobileDestination,
  deleteMobileDestination,
  updateMobileDestination,
} from '../../../../../src/trips/planning-commands';
import { useCountries } from '../../../../../src/trips/use-countries';
import { useTripDetail } from '../../../../../src/trips/use-trip-detail';

const LEVELS: readonly WireComfortLevel[] = ['budget', 'mid', 'luxury'];

export default function DestinationEditorScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { id = '', destinationId = 'new' } = useLocalSearchParams<{
    id: string;
    destinationId: string;
  }>();
  const creating = destinationId === 'new';
  const { state } = useTripDetail(id);
  const { countries, loading: countriesLoading, error: countriesError } = useCountries();
  const existing =
    state.status === 'loaded'
      ? state.trip.destinations.find((d) => d.id === destinationId)
      : undefined;
  const initialized = useRef(false);
  const budgetEdited = useRef(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [comfortLevel, setComfortLevel] = useState<WireComfortLevel>('mid');
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creating && existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      setCountry(existing.country);
      setCity(existing.city ?? '');
      setStartDate(existing.startDate ?? '');
      setEndDate(existing.endDate ?? '');
      setBudget(String(existing.estimatedBudget.amountPence / 100));
      setComfortLevel(existing.comfortLevel);
      budgetEdited.current = true;
    }
  }, [creating, existing]);

  const matches = useMemo(
    () =>
      country.trim().length < 2
        ? []
        : countries
            .filter((item) => item.country.toLowerCase().includes(country.toLowerCase()))
            .slice(0, 6),
    [countries, country],
  );
  const reference = countries.find((item) => item.country === country);
  const days =
    startDate && endDate
      ? Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000)
      : 0;
  const suggestion =
    reference && days > 0
      ? Math.round((reference.suggestedDailyBudget[comfortLevel].amountPence * days) / 100)
      : null;
  useEffect(() => {
    if (!budgetEdited.current && suggestion) setBudget(String(suggestion));
  }, [suggestion]);

  if (auth.status !== 'signed_in') return null;

  const submit = async () => {
    const pence = Math.round(Number.parseFloat(budget) * 100);
    if (!reference) return setError('Select a country from the suggestions.');
    if (!Number.isInteger(pence) || pence <= 0) return setError('Enter a valid budget.');
    if ((startDate === '') !== (endDate === ''))
      return setError('Provide both start and end dates.');
    setPending(true);
    setError(null);
    const input = {
      name: name.trim(),
      country,
      city: city.trim() || null,
      latitude: existing?.latitude ?? null,
      longitude: existing?.longitude ?? null,
      estimatedBudgetPence: pence,
      comfortLevel,
      startDate: startDate || null,
      endDate: endDate || null,
    };
    const result = creating
      ? await createMobileDestination(id, input)
      : await updateMobileDestination(id, destinationId, input);
    if (result.ok) router.replace(`/trips/${id}`);
    else {
      setError(result.message);
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    const result = await deleteMobileDestination(id, destinationId);
    if (result.ok) router.replace(`/trips/${id}`);
    else {
      setError(result.message);
      setPending(false);
      setConfirmDelete(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="destination-editor-root">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>‹ Trip</Text>
        </Pressable>
        <Text style={styles.title}>{creating ? 'Add destination' : 'Edit destination'}</Text>
      </View>
      {(state.status === 'loading' || countriesLoading) && <ActivityIndicator />}
      {countriesError && <Text style={styles.error}>{countriesError}</Text>}
      {(creating || existing) && !countriesLoading && (
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Name (optional)</Text>
          <TextInput
            accessibilityLabel="Destination name"
            value={name}
            onChangeText={setName}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="destination-name"
          />
          <Text style={styles.label}>Country</Text>
          <TextInput
            accessibilityLabel="Destination country"
            value={country}
            onChangeText={setCountry}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="destination-country"
          />
          {matches.map((item) => (
            <Pressable
              key={item.alpha3}
              onPress={() => setCountry(item.country)}
              style={styles.choice}
              testID={`destination-country-${item.alpha3}`}
            >
              <Text>{item.country}</Text>
            </Pressable>
          ))}
          <Text style={styles.label}>City (optional)</Text>
          <TextInput
            accessibilityLabel="Destination city"
            value={city}
            onChangeText={setCity}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="destination-city"
          />
          <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            accessibilityLabel="Destination start date"
            value={startDate}
            onChangeText={setStartDate}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="destination-start-date"
          />
          <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
          <TextInput
            accessibilityLabel="Destination end date"
            value={endDate}
            onChangeText={setEndDate}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="destination-end-date"
          />
          <Text style={styles.label}>Comfort</Text>
          <View style={styles.row}>
            {LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => {
                  setComfortLevel(level);
                  if (!budgetEdited.current) setBudget('');
                }}
                style={[styles.option, comfortLevel === level && styles.selected]}
                testID={`destination-comfort-${level}`}
              >
                <Text>{level}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Estimated budget (GBP)</Text>
          <TextInput
            accessibilityLabel="Destination estimated budget in pounds"
            keyboardType="decimal-pad"
            value={budget}
            onChangeText={(value) => {
              budgetEdited.current = true;
              setBudget(value);
            }}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            style={styles.input}
            testID="destination-budget"
          />
          {suggestion && (
            <Text style={styles.help}>
              Suggested from country, dates, and comfort: £{suggestion}
            </Text>
          )}
          {error && (
            <Text style={styles.error} testID="destination-error">
              {error}
            </Text>
          )}
          <Pressable
            disabled={pending}
            onPress={() => void submit()}
            style={styles.primary}
            testID="destination-submit"
          >
            <Text style={styles.primaryText}>
              {pending ? 'Saving…' : creating ? 'Add destination' : 'Save destination'}
            </Text>
          </Pressable>
          {!creating &&
            (!confirmDelete ? (
              <Pressable
                onPress={() => setConfirmDelete(true)}
                style={styles.danger}
                testID="destination-delete"
              >
                <Text style={styles.dangerText}>Delete destination</Text>
              </Pressable>
            ) : (
              <View style={styles.confirm} testID="destination-delete-warning">
                <Text>Delete this destination and its spend?</Text>
                <Pressable
                  onPress={() => void remove()}
                  style={styles.dangerSolid}
                  testID="destination-delete-confirm"
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
  title: { fontSize: 26, fontWeight: '700' },
  link: { minHeight: 44, color: '#0369a1', fontSize: 17 },
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
  choice: { minHeight: 44, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 44,
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
  error: { color: '#b91c1c', paddingHorizontal: 20 },
  help: { color: '#64748b' },
});
