/**
 * Trips list screen — `/` (the `(app)` landing route, SPEC-011 /
 * EPIC-002 slice 3). After sign-in the user lands here: every trip in
 * their organisations with name, derived date range, status, and the
 * headline budget figure, served by `GET /api/v1/trips` (SPEC-009).
 *
 * States: loading spinner → list / explicit empty state / error with
 * retry. Pull-to-refresh re-fetches without blanking the list. Items
 * navigate to `/trips/{id}` (slice 4). The profile button reaches the
 * relocated Me screen at `/me` (sign-out lives there, per EPIC-001).
 *
 * Renders `null` unless auth.status === 'signed_in' — same contract as
 * the EPIC-001 Me screen (splash or AuthGuard owns the other states).
 */

import type { TripSummary } from '@travel-planner/shared';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/auth-context';
import { formatDateRange, formatPence } from '../../src/trips/format';
import { useTrips } from '../../src/trips/use-trips';

const STATUS_LABELS: Record<TripSummary['status'], string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
};

export default function TripsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { state, refreshing, reload, refresh } = useTrips();

  if (auth.status !== 'signed_in') return null;

  return (
    <SafeAreaView style={styles.root} testID="trips-screen-root">
      <View style={styles.header}>
        <Text style={styles.title}>Trips</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push('/me')}
          style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
          testID="trips-screen-profile"
        >
          <Text style={styles.profileButtonText}>Profile</Text>
        </Pressable>
      </View>

      {state.status === 'loading' && (
        <View style={styles.centred} testID="trips-screen-loading">
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.centred} testID="trips-screen-error">
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={reload}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            testID="trips-screen-retry"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {state.status === 'loaded' && (
        <FlatList
          contentContainerStyle={
            state.trips.length === 0 ? styles.centredContent : styles.listContent
          }
          data={state.trips}
          keyExtractor={(trip) => trip.id}
          ListEmptyComponent={
            <View style={styles.centred} testID="trips-screen-empty">
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyBody}>Plan your first trip on the web app.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={refreshing}
              testID="trips-screen-refresh"
            />
          }
          renderItem={({ item }) => <TripCard trip={item} />}
          testID="trips-screen-list"
        />
      )}
    </SafeAreaView>
  );
}

function TripCard({ trip }: { trip: TripSummary }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${trip.name}`}
      onPress={() => router.push(`/trips/${trip.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      testID={`trips-screen-item-${trip.id}`}
    >
      <View style={styles.cardTopRow}>
        <Text numberOfLines={1} style={styles.cardName}>
          {trip.name}
        </Text>
        <Text style={styles.cardStatus}>{STATUS_LABELS[trip.status]}</Text>
      </View>
      <Text style={styles.cardDates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
      <Text style={styles.cardBudget}>{formatPence(trip.totalBudget)} budget</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  profileButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  profileButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '500',
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  centredContent: {
    flexGrow: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#b91c1c',
    textAlign: 'center',
    maxWidth: 300,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  retryButtonPressed: {
    backgroundColor: '#1e293b',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  emptyBody: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 4,
  },
  cardPressed: {
    backgroundColor: '#f1f5f9',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardStatus: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  cardDates: {
    fontSize: 14,
    color: '#475569',
  },
  cardBudget: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
});
