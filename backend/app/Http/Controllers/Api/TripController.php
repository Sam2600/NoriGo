<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Trip;
use Illuminate\Http\JsonResponse;

class TripController extends Controller
{
    public function upcoming(): JsonResponse
    {
        $trips = Trip::query()
            ->with('bus')
            ->withCount(['bookings as confirmed_count' => fn ($q) => $q->where('status', 'confirmed')])
            ->where('status', 'scheduled')
            ->where(function ($query): void {
                $query->whereDate('trip_date', '>', now()->toDateString())
                    ->orWhere(function ($query): void {
                        $query->whereDate('trip_date', now()->toDateString())
                            ->where('departure_time', '>=', now()->format('H:i:s'));
                    });
            })
            ->orderBy('trip_date')
            ->orderBy('departure_time')
            ->get();

        $slots = $trips
            ->groupBy(fn (Trip $trip) => $trip->trip_date->toDateString().'|'.$trip->departure_time.'|'.$trip->direction)
            ->map(function ($slotTrips): array {
                $first = $slotTrips->first();
                $totalSeats = $slotTrips->sum(fn (Trip $trip) => $trip->bus?->seat_count ?? 0);
                $confirmedCount = $slotTrips->sum('confirmed_count');

                return [
                    'trip_date' => $first->trip_date->toDateString(),
                    'departure_time' => $first->departure_time,
                    'direction' => $first->direction,
                    'slot_trip_count' => $slotTrips->count(),
                    'requires_rebalance' => $slotTrips->count() > 1,
                    'assigned_bus_code' => $slotTrips->count() === 1 ? $first->bus?->bus_code : null,
                    'bus_codes' => $slotTrips->pluck('bus.bus_code')->filter()->values()->all(),
                    'total_seats' => $totalSeats,
                    'available_seats' => max(0, $totalSeats - $confirmedCount),
                    'confirmation_deadline' => $slotTrips
                        ->filter(fn (Trip $trip) => $trip->confirmation_deadline)
                        ->sortBy('confirmation_deadline')
                        ->first()
                        ?->confirmation_deadline
                        ?->toISOString(),
                ];
            })
            ->values();

        return response()->json(['data' => $slots]);
    }
}
