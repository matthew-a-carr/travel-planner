import type { WireSpendCategory } from '@travel-planner/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../src/auth/auth-context';
import { formatIsoDate, formatPence } from '../../../../src/trips/format';
import { useTripFinancials } from '../../../../src/trips/use-trip-financials';

const CATEGORY_LABELS: Record<WireSpendCategory, string> = {
  accommodation: 'Accommodation',
  food: 'Food',
  transport: 'Transport',
  activities: 'Activities',
  shopping: 'Shopping',
  other: 'Other',
};

const gbp = (amountPence: number) => ({ amountPence, currency: 'GBP' as const });

export default function FinanceScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { state, reload } = useTripFinancials(id);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  if (auth.status !== 'signed_in') return null;

  return (
    <SafeAreaView style={styles.root} testID="finance-root">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.link}>‹ Trip</Text>
        </Pressable>
        <Text style={styles.title}>Spend & budget</Text>
        <Pressable
          onPress={() => router.push(`/trips/${id}/spend/new`)}
          accessibilityRole="button"
          testID="finance-add-spend"
        >
          <Text style={styles.link}>Add spend</Text>
        </Pressable>
      </View>
      {state.status === 'loading' && <ActivityIndicator size="large" style={styles.centred} />}
      {state.status === 'not_found' && (
        <Text style={styles.centred} testID="finance-not-found">
          Trip not found.
        </Text>
      )}
      {state.status === 'error' && (
        <View style={styles.centred}>
          <Text style={styles.error}>{state.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={reload}
            style={styles.button}
            testID="finance-retry"
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      )}
      {state.status === 'loaded' && (
        <ScrollView contentContainerStyle={styles.content}>
          {!alertsDismissed && state.financials.alerts.length > 0 && (
            <View style={styles.alerts} testID="finance-alerts">
              {state.financials.alerts.map((alert) => (
                <Text key={`${alert.type}-${alert.message}`} style={styles.alertText}>
                  {alert.message}
                </Text>
              ))}
              <Pressable
                accessibilityLabel="Dismiss budget alerts"
                accessibilityRole="button"
                onPress={() => setAlertsDismissed(true)}
                testID="finance-dismiss-alerts"
              >
                <Text style={styles.link}>Dismiss</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Budget pace</Text>
            {state.financials.burndown ? (
              <>
                <Metric
                  label="Daily spend"
                  testID="finance-daily-pace"
                  value={formatPence(gbp(state.financials.burndown.dailyPacePence))}
                />
                <Metric
                  label="Target pace"
                  testID="finance-target-pace"
                  value={formatPence(gbp(state.financials.burndown.targetPacePence))}
                />
                <Metric
                  label="Pace"
                  value={`${Math.round(state.financials.burndown.paceRatio * 100)}%`}
                />
                {state.financials.burndown.projectedExhaustionDate && (
                  <Metric
                    label="Projected exhaustion"
                    value={formatIsoDate(state.financials.burndown.projectedExhaustionDate)}
                  />
                )}
              </>
            ) : (
              <Text style={styles.muted} testID="finance-burndown-unavailable">
                Add dated destinations to calculate budget pace.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>By category</Text>
            {state.financials.categoryTotals.length === 0 ? (
              <Text style={styles.muted}>No category totals yet.</Text>
            ) : (
              state.financials.categoryTotals.map((total) => {
                const max = state.financials.categoryTotals[0]?.amountPence || 1;
                const amount = formatPence(gbp(total.amountPence));
                return (
                  <View
                    accessibilityLabel={CATEGORY_LABELS[total.category]}
                    accessibilityValue={{ text: amount }}
                    key={total.category}
                    testID={`finance-category-${total.category}`}
                  >
                    <View style={styles.metricRow}>
                      <Text>{CATEGORY_LABELS[total.category]}</Text>
                      <Text>{amount}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { width: `${Math.max(4, (total.amountPence / max) * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Entries</Text>
            {state.financials.entries.length === 0 ? (
              <Text style={styles.muted} testID="finance-empty">
                No spend recorded yet.
              </Text>
            ) : (
              state.financials.entries.map((entry) => (
                <Pressable
                  accessibilityRole="button"
                  key={entry.id}
                  onPress={() => router.push(`/trips/${id}/spend/${entry.id}`)}
                  style={styles.entry}
                  testID={`finance-entry-${entry.id}`}
                >
                  <View>
                    <Text style={styles.entryTitle}>
                      {entry.description || CATEGORY_LABELS[entry.category]}
                    </Text>
                    <Text style={styles.muted}>
                      {CATEGORY_LABELS[entry.category]} · {formatIsoDate(entry.spentAt)}
                    </Text>
                  </View>
                  <Text style={styles.entryAmount}>{formatPence(entry.amount)}</Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Metric({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.metricRow} testID={testID}>
      <Text>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, gap: 6 },
  link: { color: '#0369a1', fontSize: 17, minHeight: 44 },
  title: { fontSize: 28, fontWeight: '700' },
  centred: { margin: 32, gap: 12 },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, gap: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metricValue: { fontWeight: '600' },
  muted: { color: '#64748b' },
  alerts: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 16, gap: 8 },
  alertText: { color: '#9a3412', fontWeight: '600' },
  barTrack: { height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, backgroundColor: '#0369a1', borderRadius: 5 },
  entry: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 10,
  },
  entryTitle: { fontWeight: '600' },
  entryAmount: { fontWeight: '700' },
  error: { color: '#b91c1c' },
  button: { backgroundColor: '#0f172a', borderRadius: 8, minHeight: 44, padding: 12 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
