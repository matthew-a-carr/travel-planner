/**
 * Trip detail screen — `/trips/{id}` (SPEC-012, the EPIC-002 milestone).
 * The composite payload from `GET /api/v1/trips/{id}` (SPEC-010) renders
 * as: header (back + name + status), date range, the spend summary
 * (budget vs committed/spent), the timeline (destination legs with
 * per-destination spend), and the committed fixed-cost line items.
 *
 * `not_found` is a first-class state (deleted trip / revoked access —
 * the server's 404 collapse keeps the copy neutral). Pull-to-refresh
 * re-fetches without blanking the loaded detail.
 */

import type { TripDestination, TripDetail, TripFixedCost } from '@travel-planner/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/auth/auth-context';
import {
  formatComfortLevel,
  formatDateRange,
  formatIsoDate,
  formatPence,
} from '../../../src/trips/format';
import { useTripDetail } from '../../../src/trips/use-trip-detail';

const STATUS_LABELS: Record<TripDetail['status'], string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
};

export default function TripDetailScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, refreshing, reload, refresh } = useTripDetail(id ?? '');

  if (auth.status !== 'signed_in') return null;

  return (
    <SafeAreaView style={styles.root} testID="trip-detail-root">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to trips"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          testID="trip-detail-back"
        >
          <Text style={styles.backButtonText}>‹ Trips</Text>
        </Pressable>
      </View>

      {state.status === 'loading' && (
        <View style={styles.centred} testID="trip-detail-loading">
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      )}

      {state.status === 'not_found' && (
        <View style={styles.centred} testID="trip-detail-not-found">
          <Text style={styles.notFoundTitle}>Trip not found</Text>
          <Text style={styles.notFoundBody}>
            It may have been deleted, or you may no longer have access.
          </Text>
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.centred} testID="trip-detail-error">
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={reload}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            testID="trip-detail-retry"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {state.status === 'loaded' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={refreshing}
            />
          }
          testID="trip-detail-scroll"
        >
          <TripDetailBody trip={state.trip} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TripDetailBody({ trip }: { trip: TripDetail }) {
  return (
    <>
      <View style={styles.titleBlock}>
        <Text style={styles.tripName} testID="trip-detail-name">
          {trip.name}
        </Text>
        <Text style={styles.tripMeta}>
          {STATUS_LABELS[trip.status]} · {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
      </View>

      <View style={styles.card} testID="trip-detail-spend">
        <Text style={styles.sectionTitle}>Spend</Text>
        <SpendRow label="Total budget" money={trip.spend.totalBudget} />
        <SpendRow label="Fixed costs" money={trip.spend.fixedCosts} />
        <SpendRow label="Allocated to destinations" money={trip.spend.allocated} />
        <SpendRow
          label="Available"
          money={trip.spend.available}
          emphasis={trip.spend.isOverAllocated ? 'over' : 'normal'}
        />
        <SpendRow label="Spent so far" money={trip.spend.spent} />
        {trip.spend.isOverAllocated && (
          <Text style={styles.overAllocated} testID="trip-detail-over-allocated">
            Over budget — committed costs exceed the total budget.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        {trip.destinations.length === 0 ? (
          <Text style={styles.emptyText} testID="trip-detail-timeline-empty">
            No destinations yet — add them on the web app.
          </Text>
        ) : (
          trip.destinations.map((destination) => (
            <DestinationLeg destination={destination} key={destination.id} />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fixed costs</Text>
        {trip.fixedCosts.length === 0 ? (
          <Text style={styles.emptyText} testID="trip-detail-fixed-costs-empty">
            No fixed costs recorded.
          </Text>
        ) : (
          trip.fixedCosts.map((fixedCost) => (
            <FixedCostRow fixedCost={fixedCost} key={fixedCost.id} />
          ))
        )}
      </View>
    </>
  );
}

function SpendRow({
  label,
  money,
  emphasis = 'normal',
}: {
  label: string;
  money: TripDetail['spend']['totalBudget'];
  emphasis?: 'normal' | 'over';
}) {
  return (
    <View style={styles.spendRow}>
      <Text style={styles.spendLabel}>{label}</Text>
      <Text style={[styles.spendValue, emphasis === 'over' && styles.spendValueOver]}>
        {formatPence(money)}
      </Text>
    </View>
  );
}

function DestinationLeg({ destination }: { destination: TripDestination }) {
  const location = destination.city
    ? `${destination.city}, ${destination.country}`
    : destination.country;
  return (
    <View style={styles.leg} testID={`trip-detail-destination-${destination.id}`}>
      <View style={styles.legTopRow}>
        <Text numberOfLines={1} style={styles.legName}>
          {destination.name}
        </Text>
        <Text style={styles.legComfort}>{formatComfortLevel(destination.comfortLevel)}</Text>
      </View>
      <Text style={styles.legMeta}>{location}</Text>
      <Text style={styles.legMeta}>
        {formatDateRange(destination.startDate, destination.endDate)}
      </Text>
      <Text style={styles.legBudget}>
        {formatPence(destination.spent)} spent of {formatPence(destination.estimatedBudget)} budget
      </Text>
    </View>
  );
}

function FixedCostRow({ fixedCost }: { fixedCost: TripFixedCost }) {
  return (
    <View style={styles.spendRow} testID={`trip-detail-fixed-cost-${fixedCost.id}`}>
      <View style={styles.fixedCostLabelBlock}>
        <Text style={styles.spendLabel}>{fixedCost.label}</Text>
        <Text style={styles.fixedCostDate}>{formatIsoDate(fixedCost.date)}</Text>
      </View>
      <Text style={styles.spendValue}>{formatPence(fixedCost.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0f172a',
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  notFoundBody: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 300,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  titleBlock: {
    gap: 4,
  },
  tripName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  tripMeta: {
    fontSize: 15,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  spendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  spendLabel: {
    fontSize: 15,
    color: '#334155',
  },
  spendValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  spendValueOver: {
    color: '#b91c1c',
  },
  overAllocated: {
    fontSize: 13,
    color: '#b91c1c',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
  },
  leg: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 2,
  },
  legTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  legName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  legComfort: {
    fontSize: 13,
    color: '#475569',
  },
  legMeta: {
    fontSize: 14,
    color: '#475569',
  },
  legBudget: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    marginTop: 2,
  },
  fixedCostLabelBlock: {
    flex: 1,
  },
  fixedCostDate: {
    fontSize: 13,
    color: '#64748b',
  },
});
