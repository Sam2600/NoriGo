<?php

namespace App\Services;

use App\Models\Trip;

class BookingCapacityService
{
    /**
     * Find the trip in a given slot with the most room left.
     * Returns null when the slot has no trips or all buses are full.
     */
    public function slotBestTrip(string $date, string $time, string $direction): ?Trip
    {
        $trips = Trip::query()
            ->with('bus')
            ->withCount(['bookings as confirmed_count' => fn ($q) => $q->where('status', 'confirmed')])
            ->where('status', 'scheduled')
            ->whereDate('trip_date', $date)
            ->where('departure_time', $time)
            ->where('direction', $direction)
            ->get();

        return $trips
            ->filter(fn ($trip) => $trip->bus && ($trip->bus->seat_count - $trip->confirmed_count) > 0)
            ->sortBy('confirmed_count')
            ->first();
    }

    public function slotTripCount(string $date, string $time, string $direction): int
    {
        return Trip::query()
            ->where('status', 'scheduled')
            ->whereDate('trip_date', $date)
            ->where('departure_time', $time)
            ->where('direction', $direction)
            ->count();
    }

    public function requiresFleetRebalance(Trip $trip): bool
    {
        return $this->slotTripCount(
            $trip->trip_date->toDateString(),
            $trip->departure_time,
            $trip->direction,
        ) > 1;
    }

    public function confirmedCount(Trip $trip): int
    {
        return $trip->bookings()
            ->where('status', 'confirmed')
            ->count();
    }

    public function availableSeats(Trip $trip): ?int
    {
        if (! $trip->bus) {
            return null;
        }

        return max(0, $trip->bus->seat_count - $this->confirmedCount($trip));
    }

    public function hasAvailableSeat(Trip $trip): bool
    {
        $availableSeats = $this->availableSeats($trip);

        return $availableSeats === null || $availableSeats > 0;
    }
}
