<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Location;
use App\Models\Trip;
use App\Models\TripRoutePlan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class FleetAssignmentService
{
    /** @var array<int, TripRoutePlan|null> */
    private array $routePlanCache = [];

    public function __construct(
        private NotificationDispatchService $notifications,
        private TripRouteService $routes,
        private MapboxRouteOptimizationService $optimizer,
    ) {
        //
    }

    /**
     * @param  array<int, int>  $tripIds
     * @return array<string, mixed>
     */
    public function preview(array $tripIds): array
    {
        return $this->buildPlan($tripIds);
    }

    /**
     * @param  array<int, int>  $tripIds
     * @return array<string, mixed>
     */
    public function apply(array $tripIds, User $admin): array
    {
        return DB::transaction(function () use ($tripIds, $admin): array {
            $plan = $this->buildPlan($tripIds);
            $trips = Trip::query()
                ->with(['bus', 'routePlan'])
                ->whereIn('id', collect($tripIds)->unique()->values()->all())
                ->get()
                ->keyBy('id');
            $movedBookingIds = collect();
            $allAssignments = collect();

            foreach ($plan['groups'] as $group) {
                $targetTrip = $trips->get($group['trip_id']);

                foreach ($group['assignments'] as $assignment) {
                    /** @var Booking $booking */
                    $booking = Booking::query()
                        ->with(['user', 'passengerStatus'])
                        ->findOrFail($assignment['booking_id']);

                    if ($booking->trip_id !== $targetTrip->id) {
                        $booking->update(['trip_id' => $targetTrip->id]);

                        if ($booking->passengerStatus) {
                            $booking->passengerStatus->update(['trip_id' => $targetTrip->id]);
                        }

                        $movedBookingIds->push($booking->id);
                    }

                    $allAssignments->push([
                        'booking' => $booking->refresh()->load(['user', 'pickupLocation']),
                        'trip' => $targetTrip,
                    ]);
                }

                $targetTrip?->routePlan?->delete();
                $targetTrip?->unsetRelation('routePlan');
                $targetTrip?->unsetRelation('bookings');
            }

            // Notify every employee — not just moved ones — so everyone knows their bus.
            $allAssignments->each(function (array $item) use ($admin, $movedBookingIds): void {
                $booking = $item['booking'];
                $trip = $item['trip'];
                $busCode = $trip?->bus?->bus_code ?? 'TBD';

                if (! $booking->user) {
                    return;
                }

                $wasMoved = $movedBookingIds->contains($booking->id);
                $message = $this->busAssignmentMessage($trip, $booking, $busCode, $wasMoved);

                $this->notifications->sendToUsers([$booking->user], [
                    'created_by' => $admin->id,
                    'related_trip_id' => $booking->trip_id,
                    'title' => 'Bus assignment confirmed',
                    'message' => $message,
                    'type' => 'schedule_change',
                    'priority' => 'high',
                ]);
            });

            return [
                ...$plan,
                'applied' => true,
                'moved_bookings_count' => $movedBookingIds->count(),
            ];
        });
    }

    /**
     * @param  array<int, int>  $tripIds
     * @return array<string, mixed>
     */
    public function notifyBusAssignments(array $tripIds, User $admin): array
    {
        return DB::transaction(function () use ($tripIds, $admin): array {
            $trips = $this->loadTripsForNotification($tripIds);
            $firstTrip = $trips->first();

            $groups = $trips
                ->map(function (Trip $trip) use ($admin): array {
                    $activeBookings = $trip->bookings
                        ->filter(fn (Booking $booking): bool => in_array($booking->status, ['pending', 'confirmed'], true) && (bool) $booking->user)
                        ->values();
                    $busCode = $trip->bus?->bus_code ?? 'TBD';

                    $sent = $activeBookings
                        ->map(fn (Booking $booking): Collection => $this->notifications->sendToUsers([$booking->user], [
                            'created_by' => $admin->id,
                            'related_trip_id' => $trip->id,
                            'title' => 'Bus assignment confirmed',
                            'message' => $this->busAssignmentMessage($trip, $booking, $busCode),
                            'type' => 'schedule_change',
                            'priority' => 'high',
                        ]))
                        ->sum(fn (Collection $notifications): int => $notifications->count());

                    return [
                        'trip_id' => $trip->id,
                        'bus' => [
                            'id' => $trip->bus?->id,
                            'bus_code' => $busCode,
                        ],
                        'passenger_count' => $activeBookings->count(),
                        'sent_count' => $sent,
                    ];
                })
                ->values();

            $sentCount = (int) $groups->sum('sent_count');

            if ($sentCount < 1) {
                throw ValidationException::withMessages([
                    'trip_ids' => 'There are no pending or confirmed bookings to notify.',
                ]);
            }

            return [
                'sent_count' => $sentCount,
                'trip_date' => $firstTrip->trip_date?->toDateString(),
                'departure_time' => $firstTrip->departure_time,
                'direction' => $firstTrip->direction,
                'groups' => $groups->all(),
            ];
        });
    }

    /**
     * @param  array<int, int>  $tripIds
     * @return array<string, mixed>
     */
    private function buildPlan(array $tripIds): array
    {
        $trips = $this->loadTrips($tripIds);
        $firstTrip = $trips->first();
        $activeBookings = $this->activeBookings($trips);

        if ($activeBookings->isEmpty()) {
            throw ValidationException::withMessages([
                'trip_ids' => 'There are no pending or confirmed bookings to rebalance.',
            ]);
        }

        $items = $this->assignmentItems($firstTrip, $activeBookings);
        $capacities = $trips->map(fn (Trip $trip): int => (int) $trip->bus->seat_count)->values()->all();
        $limits = $this->capacityLimits($items->count(), $capacities);
        $groups = $this->clusterAssignments($trips, $items, $limits);

        return [
            'applied' => false,
            'strategy' => 'coordinate_clustering',
            'target_type' => $firstTrip->direction === 'dropoff' ? 'dropoff' : 'pickup',
            'trip_date' => $firstTrip->trip_date?->toDateString(),
            'departure_time' => $firstTrip->departure_time,
            'direction' => $firstTrip->direction,
            'total_bookings' => $items->count(),
            'total_capacity' => array_sum($capacities),
            'estimated_total_distance_meters' => collect($groups)->sum('estimated_distance_meters'),
            'groups' => $groups,
        ];
    }

    /**
     * @param  array<int, int>  $tripIds
     * @return Collection<int, Trip>
     */
    private function loadTrips(array $tripIds): Collection
    {
        $ids = collect($tripIds)
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values();

        if ($ids->count() < 2) {
            throw ValidationException::withMessages([
                'trip_ids' => 'Select at least two trips to rebalance employees across buses.',
            ]);
        }

        $trips = Trip::query()
            ->with([
                'bus',
                'driver',
                'routeStartLocation',
                'routeEndLocation',
                'bookings.user',
                'bookings.pickupLocation',
                'bookings.dropoffLocation',
                'bookings.passengerStatus',
            ])
            ->whereIn('id', $ids->all())
            ->get()
            ->sortBy(fn (Trip $trip): int => $ids->search($trip->id))
            ->values();

        if ($trips->count() !== $ids->count()) {
            throw ValidationException::withMessages([
                'trip_ids' => 'One or more selected trips could not be found.',
            ]);
        }

        $this->validateTrips($trips);

        return $trips;
    }

    /**
     * @param  array<int, int>  $tripIds
     * @return Collection<int, Trip>
     */
    private function loadTripsForNotification(array $tripIds): Collection
    {
        $ids = collect($tripIds)
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages([
                'trip_ids' => 'Select at least one trip to notify passengers.',
            ]);
        }

        $trips = Trip::query()
            ->with([
                'bus',
                'bookings.user',
            ])
            ->whereIn('id', $ids->all())
            ->get()
            ->sortBy(fn (Trip $trip): int => $ids->search($trip->id))
            ->values();

        if ($trips->count() !== $ids->count()) {
            throw ValidationException::withMessages([
                'trip_ids' => 'One or more selected trips could not be found.',
            ]);
        }

        $this->validateTrips($trips);

        return $trips;
    }

    /**
     * @param  Collection<int, Trip>  $trips
     */
    private function validateTrips(Collection $trips): void
    {
        $first = $trips->first();
        $date = $first->trip_date?->toDateString();

        foreach ($trips as $trip) {
            if ($trip->trip_date?->toDateString() !== $date
                || $trip->departure_time !== $first->departure_time
                || $trip->direction !== $first->direction) {
                throw ValidationException::withMessages([
                    'trip_ids' => 'Only trips with the same date, departure time, and direction can be rebalanced together.',
                ]);
            }

            if ($trip->status !== 'scheduled') {
                throw ValidationException::withMessages([
                    'trip_ids' => 'Only scheduled trips can be rebalanced.',
                ]);
            }

            if (! $trip->bus || $trip->bus->seat_count < 1) {
                throw ValidationException::withMessages([
                    'trip_ids' => 'Every selected trip must have a bus with a valid seat count.',
                ]);
            }
        }
    }

    private function cycleLabel(Trip $trip): string
    {
        return $trip->trip_date?->format('M j').' at '.Carbon::parse($trip->departure_time)->format('g:i A');
    }

    private function busAssignmentMessage(Trip $trip, Booking $booking, string $busCode, bool $wasMoved = false): string
    {
        $message = $wasMoved
            ? "Your bus was reassigned to {$busCode} for ".$this->cycleLabel($trip).'.'
            : "Your bus is confirmed: {$busCode} for ".$this->cycleLabel($trip).'.';

        $pickupEta = $this->pickupEtaForBooking($trip, $booking);

        if ($pickupEta) {
            return "{$message} Please be at {$pickupEta['location_name']} by {$pickupEta['pickup_time']}.";
        }

        return "{$message} Pickup time will be shared after route planning.";
    }

    /**
     * @return array{pickup_time: string, location_name: string}|null
     */
    private function pickupEtaForBooking(Trip $trip, Booking $booking): ?array
    {
        $routePlan = $this->currentRoutePlanForTrip($trip);

        if (! $routePlan) {
            return null;
        }

        $stop = $this->pickupStopForBooking($booking, collect($routePlan->ordered_stops));

        if (! $stop || ! array_key_exists('estimated_arrival_offset_seconds', $stop)) {
            return null;
        }

        $departureAt = Carbon::parse(
            "{$trip->trip_date->toDateString()} {$trip->departure_time}",
            config('app.operations_timezone', 'Asia/Yangon'),
        );
        $pickupAt = $departureAt->copy()->addSeconds((int) $stop['estimated_arrival_offset_seconds']);

        return [
            'pickup_time' => $pickupAt->format('g:i A'),
            'location_name' => $booking->pickupLocation?->name ?? $stop['name'] ?? 'your pickup point',
        ];
    }

    private function currentRoutePlanForTrip(Trip $trip): ?TripRoutePlan
    {
        if (array_key_exists($trip->id, $this->routePlanCache)) {
            return $this->routePlanCache[$trip->id];
        }

        $trip->loadMissing('routePlan');
        $suggestedStops = $this->routes->optimizationStopsForTrip($trip);
        $routePlan = $trip->routePlan;

        if ($routePlan
            && $routePlan->status === 'optimized'
            && $routePlan->ordered_stops
            && $routePlan->stops_hash === $this->routes->stopsHash($suggestedStops)) {
            return $this->routePlanCache[$trip->id] = $routePlan;
        }

        try {
            $trip->unsetRelation('routePlan');
            $routePlan = $this->optimizer->optimize($trip, force: true);

            return $this->routePlanCache[$trip->id] = $routePlan;
        } catch (RuntimeException) {
            return $this->routePlanCache[$trip->id] = null;
        }
    }

    private function pickupStopForBooking(Booking $booking, Collection $orderedStops): ?array
    {
        $pickupTypes = ['origin', 'origin_pickup', 'pickup'];

        return $orderedStops->first(function (array $stop) use ($booking, $pickupTypes): bool {
            $bookingIds = collect($stop['booking_ids'] ?? []);

            return in_array($stop['type'] ?? null, $pickupTypes, true)
                && ($bookingIds->contains($booking->id)
                    || ($stop['booking_id'] ?? null) === $booking->id);
        }) ?? $orderedStops->first(function (array $stop) use ($booking, $pickupTypes): bool {
            return in_array($stop['type'] ?? null, $pickupTypes, true)
                && (int) ($stop['location_id'] ?? 0) === (int) $booking->pickup_location_id;
        });
    }

    /**
     * @param  Collection<int, Trip>  $trips
     * @return Collection<int, Booking>
     */
    private function activeBookings(Collection $trips): Collection
    {
        return $trips
            ->flatMap(fn (Trip $trip): Collection => $trip->bookings
                ->filter(fn (Booking $booking): bool => in_array($booking->status, ['pending', 'confirmed'], true)))
            ->values();
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     * @return Collection<int, array<string, mixed>>
     */
    private function assignmentItems(Trip $firstTrip, Collection $bookings): Collection
    {
        $missing = collect();
        $items = collect();

        foreach ($bookings as $booking) {
            $targetLocation = $this->targetLocation($firstTrip, $booking);

            if (! $targetLocation || $targetLocation->latitude === null || $targetLocation->longitude === null) {
                $missing->push($booking->user?->name ?? "Booking #{$booking->id}");

                continue;
            }

            $items->push([
                'booking_id' => $booking->id,
                'previous_trip_id' => $booking->trip_id,
                'passenger_name' => $booking->user?->name ?? 'Passenger',
                'passenger_email' => $booking->user?->email,
                'status' => $booking->status,
                'pickup_location' => $this->locationPayload($booking->pickupLocation),
                'dropoff_location' => $this->locationPayload($booking->dropoffLocation),
                'target_location' => $this->locationPayload($targetLocation),
                'latitude' => (float) $targetLocation->latitude,
                'longitude' => (float) $targetLocation->longitude,
            ]);
        }

        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'trip_ids' => 'Every active booking must have target coordinates. Missing coordinates for: '.$missing->unique()->implode(', '),
            ]);
        }

        return $items;
    }

    private function targetLocation(Trip $trip, Booking $booking): ?Location
    {
        return $trip->direction === 'dropoff'
            ? $booking->dropoffLocation
            : $booking->pickupLocation;
    }

    /**
     * @param  array<int, int>  $capacities
     * @return array<int, int>
     */
    private function capacityLimits(int $bookingCount, array $capacities): array
    {
        if (array_sum($capacities) < $bookingCount) {
            throw ValidationException::withMessages([
                'trip_ids' => 'Selected buses do not have enough total seats for the active bookings.',
            ]);
        }

        return $capacities;
    }

    /**
     * @param  Collection<int, Trip>  $trips
     * @param  Collection<int, array<string, mixed>>  $items
     * @param  array<int, int>  $limits
     * @return array<int, array<string, mixed>>
     */
    private function clusterAssignments(Collection $trips, Collection $items, array $limits): array
    {
        $centroids = $this->initialCentroids($trips, $items);
        $groupedItems = [];

        for ($iteration = 0; $iteration < 8; $iteration++) {
            $groupedItems = array_fill(0, $trips->count(), []);
            $remainingItems = $items->values();

            if ($remainingItems->count() >= $trips->count()) {
                foreach (range(0, $trips->count() - 1) as $index) {
                    $nearest = $remainingItems
                        ->sortBy(fn (array $item): float => $this->distanceBetween($item, $centroids[$index]))
                        ->first();

                    if (! $nearest || $limits[$index] < 1) {
                        continue;
                    }

                    $groupedItems[$index][] = $nearest;
                    $remainingItems = $remainingItems
                        ->reject(fn (array $item): bool => $item['booking_id'] === $nearest['booking_id'])
                        ->values();
                }
            }

            $rankedItems = $remainingItems
                ->sortByDesc(fn (array $item): float => $this->preferenceGap($item, $centroids))
                ->values();

            foreach ($rankedItems as $item) {
                $targetGroup = collect(range(0, $trips->count() - 1))
                    ->sortBy(fn (int $index): float => $this->distanceBetween($item, $centroids[$index]))
                    ->first(fn (int $index): bool => count($groupedItems[$index]) < $limits[$index]);

                if ($targetGroup === null) {
                    throw ValidationException::withMessages([
                        'trip_ids' => 'Unable to distribute bookings within selected bus capacities.',
                    ]);
                }

                $groupedItems[$targetGroup][] = $item;
            }

            foreach ($groupedItems as $index => $group) {
                if ($group === []) {
                    continue;
                }

                $centroids[$index] = $this->meanPoint(collect($group));
            }
        }

        return $trips
            ->values()
            ->map(function (Trip $trip, int $index) use ($groupedItems, $limits): array {
                $assignments = collect($groupedItems[$index])
                    ->sortBy('passenger_name')
                    ->values();
                $estimatedDistance = $this->estimatedRouteDistance($trip, $assignments);

                return [
                    'trip_id' => $trip->id,
                    'bus' => [
                        'id' => $trip->bus?->id,
                        'bus_code' => $trip->bus?->bus_code,
                        'seat_count' => $trip->bus?->seat_count,
                    ],
                    'driver' => [
                        'id' => $trip->driver?->id,
                        'name' => $trip->driver?->name,
                    ],
                    'limit' => $limits[$index],
                    'booking_count' => $assignments->count(),
                    'moved_count' => $assignments->filter(fn (array $item): bool => $item['previous_trip_id'] !== $trip->id)->count(),
                    'estimated_distance_meters' => $estimatedDistance,
                    'estimated_distance_km' => round($estimatedDistance / 1000, 2),
                    'assignments' => $assignments->map(fn (array $item): array => [
                        ...$item,
                        'assigned_trip_id' => $trip->id,
                        'will_move' => $item['previous_trip_id'] !== $trip->id,
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Trip>  $trips
     * @param  Collection<int, array<string, mixed>>  $items
     * @return array<int, array{latitude: float, longitude: float}>
     */
    private function initialCentroids(Collection $trips, Collection $items): array
    {
        $basePoint = $this->routeAnchorPoint($trips->first()) ?? $this->meanPoint($items);
        $centroids = [];

        $centroids[] = $items
            ->sortByDesc(fn (array $item): float => $this->distanceBetween($item, $basePoint))
            ->first();

        while (count($centroids) < $trips->count()) {
            $centroids[] = $items
                ->sortByDesc(fn (array $item): float => collect($centroids)
                    ->map(fn (array $centroid): float => $this->distanceBetween($item, $centroid))
                    ->min())
                ->first();
        }

        return collect($centroids)
            ->map(fn (array $point): array => [
                'latitude' => (float) $point['latitude'],
                'longitude' => (float) $point['longitude'],
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<int, array{latitude: float, longitude: float}>  $centroids
     */
    private function preferenceGap(array $item, array $centroids): float
    {
        if (count($centroids) < 2) {
            return 0;
        }

        $distances = collect($centroids)
            ->map(fn (array $centroid): float => $this->distanceBetween($item, $centroid))
            ->sort()
            ->values();

        return (float) $distances->get(1) - (float) $distances->get(0);
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @return array{latitude: float, longitude: float}
     */
    private function meanPoint(Collection $items): array
    {
        return [
            'latitude' => (float) $items->avg('latitude'),
            'longitude' => (float) $items->avg('longitude'),
        ];
    }

    private function routeAnchorPoint(Trip $trip): ?array
    {
        $location = $trip->routeStartLocation;

        if (! $location || $location->latitude === null || $location->longitude === null) {
            return null;
        }

        return [
            'latitude' => (float) $location->latitude,
            'longitude' => (float) $location->longitude,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $assignments
     */
    private function estimatedRouteDistance(Trip $trip, Collection $assignments): int
    {
        if ($assignments->isEmpty()) {
            return 0;
        }

        $current = $this->routeAnchorPoint($trip) ?? $this->meanPoint($assignments);
        $remaining = $assignments->values();
        $distance = 0.0;

        while ($remaining->isNotEmpty()) {
            $nearest = $remaining
                ->sortBy(fn (array $item): float => $this->distanceBetween($current, $item))
                ->first();

            $distance += $this->distanceBetween($current, $nearest);
            $current = $nearest;
            $remaining = $remaining
                ->reject(fn (array $item): bool => $item['booking_id'] === $nearest['booking_id'])
                ->values();
        }

        if ($trip->routeEndLocation?->latitude !== null && $trip->routeEndLocation?->longitude !== null) {
            $distance += $this->distanceBetween($current, [
                'latitude' => (float) $trip->routeEndLocation->latitude,
                'longitude' => (float) $trip->routeEndLocation->longitude,
            ]);
        }

        return (int) round($distance);
    }

    /**
     * @param  array<string, mixed>  $left
     * @param  array<string, mixed>  $right
     */
    private function distanceBetween(array $left, array $right): float
    {
        $earthRadiusMeters = 6371000;
        $lat1 = deg2rad((float) $left['latitude']);
        $lat2 = deg2rad((float) $right['latitude']);
        $deltaLat = deg2rad((float) $right['latitude'] - (float) $left['latitude']);
        $deltaLng = deg2rad((float) $right['longitude'] - (float) $left['longitude']);

        $a = sin($deltaLat / 2) ** 2
            + cos($lat1) * cos($lat2) * sin($deltaLng / 2) ** 2;

        return $earthRadiusMeters * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function locationPayload(?Location $location): ?array
    {
        if (! $location) {
            return null;
        }

        return [
            'id' => $location->id,
            'name' => $location->name,
            'address' => $location->address,
            'latitude' => $location->latitude !== null ? (float) $location->latitude : null,
            'longitude' => $location->longitude !== null ? (float) $location->longitude : null,
        ];
    }
}
