<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Location;
use App\Models\Trip;
use Illuminate\Support\Collection;

class TripRouteService
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function stopsForTrip(Trip $trip): Collection
    {
        $activeBookings = $this->activeBookings($trip);

        $pickupStops = $activeBookings
            ->map(fn (Booking $booking): ?array => $this->stopFromLocation($booking, $booking->pickupLocation, 'pickup'))
            ->filter();

        $dropoffStops = $activeBookings
            ->map(fn (Booking $booking): ?array => $this->stopFromLocation($booking, $booking->dropoffLocation, 'dropoff'))
            ->filter();

        return $pickupStops
            ->merge($dropoffStops)
            ->values();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function optimizationStopsForTrip(Trip $trip): Collection
    {
        $activeBookings = $this->activeBookings($trip);

        if ($activeBookings->isEmpty()) {
            return collect();
        }

        if ($trip->direction === 'pickup') {
            return $this->pickupOptimizationStops($trip, $activeBookings);
        }

        return $this->dropoffOptimizationStops($trip, $activeBookings);
    }

    public function stopsHash(Collection $stops): string
    {
        return hash('sha256', $stops
            ->map(fn (array $stop): array => [
                'type' => $stop['type'],
                'location_id' => $stop['location_id'],
                'latitude' => (string) $stop['latitude'],
                'longitude' => (string) $stop['longitude'],
                'passenger_names' => $stop['passenger_names'] ?? [$stop['passenger_name'] ?? null],
            ])
            ->values()
            ->toJson());
    }

    /**
     * @return Collection<int, Booking>
     */
    private function activeBookings(Trip $trip): Collection
    {
        $trip->loadMissing([
            'bookings.user',
            'bookings.pickupLocation',
            'bookings.dropoffLocation',
            'routeStartLocation',
            'routeEndLocation',
        ]);

        return $trip->bookings
            ->filter(fn (Booking $booking): bool => in_array($booking->status, ['pending', 'confirmed'], true))
            ->sortBy('created_at')
            ->values();
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     * @return Collection<int, array<string, mixed>>
     */
    private function dropoffOptimizationStops(Trip $trip, Collection $bookings): Collection
    {
        $origin = $this->stopFromRouteLocation($trip->routeStartLocation, 'origin')
            ?? $this->mostCommonLocationStop($bookings, 'pickup', 'origin');
        $destinations = $this->uniqueLocationStops($bookings, 'dropoff');

        if (! $origin && $destinations->isNotEmpty()) {
            $origin = $destinations->shift();
            $origin['type'] = 'origin';
        }

        if (! $origin) {
            return $destinations->values();
        }

        $final = $this->stopFromRouteLocation($trip->routeEndLocation, 'final_destination')
            ?? $this->farthestStopFrom($origin, $destinations);
        $middle = $destinations
            ->reject(fn (array $stop): bool => $this->sameStop($stop, $origin)
                || ($final && $this->sameStop($stop, $final)))
            ->values();

        return collect([$origin])
            ->merge($middle)
            ->when($final && ! $this->sameStop($origin, $final), fn (Collection $stops): Collection => $stops->push([
                ...$final,
                'type' => $final['type'] === 'final_destination' ? 'final_destination' : 'final_dropoff',
            ]))
            ->values();
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     * @return Collection<int, array<string, mixed>>
     */
    private function pickupOptimizationStops(Trip $trip, Collection $bookings): Collection
    {
        $destination = $this->stopFromRouteLocation($trip->routeEndLocation, 'final_destination')
            ?? $this->mostCommonLocationStop($bookings, 'dropoff', 'final_destination');
        $pickups = $this->uniqueLocationStops($bookings, 'pickup');

        $origin = $this->stopFromRouteLocation($trip->routeStartLocation, 'origin')
            ?? ($destination ? $this->farthestStopFrom($destination, $pickups) : $pickups->shift());

        $middle = $pickups
            ->reject(fn (array $stop): bool => ($origin && $this->sameStop($stop, $origin))
                || ($destination && $this->sameStop($stop, $destination)))
            ->values();

        return collect()
            ->when($origin, fn (Collection $stops): Collection => $stops->push([
                ...$origin,
                'type' => $origin['type'] === 'origin' ? 'origin' : 'origin_pickup',
            ]))
            ->merge($middle)
            ->when($destination && (! $origin || ! $this->sameStop($origin, $destination)), fn (Collection $stops): Collection => $stops->push($destination))
            ->values();
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     * @return Collection<int, array<string, mixed>>
     */
    private function uniqueLocationStops(Collection $bookings, string $locationType): Collection
    {
        return $bookings
            ->map(fn (Booking $booking): ?array => $this->stopFromLocation(
                $booking,
                $locationType === 'pickup' ? $booking->pickupLocation : $booking->dropoffLocation,
                $locationType
            ))
            ->filter()
            ->groupBy(fn (array $stop): string => "{$stop['location_id']}:{$stop['latitude']}:{$stop['longitude']}:{$stop['type']}")
            ->map(fn (Collection $group): array => $this->mergeStopGroup($group))
            ->values();
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     */
    private function mostCommonLocationStop(Collection $bookings, string $locationType, string $type): ?array
    {
        $stop = $this->uniqueLocationStops($bookings, $locationType)
            ->sortByDesc(fn (array $stop): int => count($stop['passenger_names'] ?? []))
            ->first();

        if (! $stop) {
            return null;
        }

        return [
            ...$stop,
            'type' => $type,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $group
     */
    private function mergeStopGroup(Collection $group): array
    {
        $first = $group->first();

        return [
            ...$first,
            'booking_ids' => $group->pluck('booking_id')->values()->all(),
            'passenger_names' => $group->pluck('passenger_name')->filter()->unique()->values()->all(),
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $stops
     */
    private function farthestStopFrom(array $origin, Collection $stops): ?array
    {
        return $stops
            ->sortByDesc(fn (array $stop): float => $this->distanceBetween($origin, $stop))
            ->first();
    }

    private function sameStop(array $left, array $right): bool
    {
        return $left['location_id'] === $right['location_id']
            && (string) $left['latitude'] === (string) $right['latitude']
            && (string) $left['longitude'] === (string) $right['longitude'];
    }

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

    private function stopFromLocation(Booking $booking, ?Location $location, string $type): ?array
    {
        if (! $location || $location->latitude === null || $location->longitude === null) {
            return null;
        }

        return [
            'booking_id' => $booking->id,
            'location_id' => $location->id,
            'type' => $type,
            'name' => $location->name,
            'address' => $location->address,
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'passenger_name' => $booking->user?->name,
            'passenger_status' => $booking->status,
        ];
    }

    private function stopFromRouteLocation(?Location $location, string $type): ?array
    {
        if (! $location || $location->latitude === null || $location->longitude === null) {
            return null;
        }

        return [
            'booking_id' => null,
            'booking_ids' => [],
            'location_id' => $location->id,
            'type' => $type,
            'name' => $location->name,
            'address' => $location->address,
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'passenger_name' => null,
            'passenger_names' => [],
            'passenger_status' => null,
        ];
    }
}
