<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\TripPassengerStatus;
use App\Services\BookingCapacityService;
use App\Services\NotificationDispatchService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()
                ->bookings()
                ->with(['trip.bus', 'pickupLocation', 'dropoffLocation', 'passengerStatus'])
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request, NotificationDispatchService $notifications, BookingCapacityService $capacity): JsonResponse
    {
        $validated = $request->validate([
            'trip_date' => ['required', 'date'],
            'departure_time' => ['required', 'string'],
            'direction' => ['required', Rule::in(['pickup', 'dropoff'])],
            'pickup_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'dropoff_location_id' => ['nullable', 'integer', 'exists:locations,id'],
        ]);

        $trip = $capacity->slotBestTrip($validated['trip_date'], $validated['departure_time'], $validated['direction']);

        if (! $trip) {
            abort(422, 'No seats available for this trip.');
        }

        if ($trip->confirmation_deadline && now()->greaterThan($trip->confirmation_deadline)) {
            abort(422, 'The confirmation deadline has passed.');
        }

        $hasActiveBooking = Booking::query()
            ->whereHas('trip', fn ($q) => $q
                ->whereDate('trip_date', $validated['trip_date'])
                ->where('departure_time', $validated['departure_time'])
                ->where('direction', $validated['direction'])
            )
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'confirmed'])
            ->exists();

        if ($hasActiveBooking) {
            abort(422, 'You already have an active booking for this trip.');
        }

        $profile = $request->user()->profile;

        $booking = Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $request->user()->id,
            'pickup_location_id' => $validated['pickup_location_id'] ?? $profile?->default_pickup_location_id,
            'dropoff_location_id' => $validated['dropoff_location_id'] ?? $profile?->default_dropoff_location_id,
            'status' => 'confirmed',
        ]);

        TripPassengerStatus::query()->firstOrCreate(
            ['trip_id' => $booking->trip_id, 'booking_id' => $booking->id],
            ['passenger_status' => 'waiting'],
        );

        $message = $this->confirmationMessage($trip, $capacity->requiresFleetRebalance($trip));

        $notifications->sendToUsers([$request->user()], [
            'title' => 'Booking confirmed',
            'message' => $message,
            'type' => 'booking',
            'related_trip_id' => $trip->id,
        ]);

        return response()->json([
            'message' => $message,
            'data' => $booking->load(['trip.bus', 'pickupLocation', 'dropoffLocation']),
        ], 201);
    }

    public function show(Request $request, Booking $booking): JsonResponse
    {
        $this->abortUnlessOwner($request, $booking);

        return response()->json([
            'data' => $booking->load(['trip.bus', 'pickupLocation', 'dropoffLocation', 'passengerStatus']),
        ]);
    }

    public function cancel(Request $request, Booking $booking, NotificationDispatchService $notifications): JsonResponse
    {
        $this->abortUnlessOwner($request, $booking);

        if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
            abort(422, 'This booking cannot be cancelled.');
        }

        if ($booking->trip->status !== 'scheduled') {
            abort(422, 'Bookings can only be cancelled before the trip starts.');
        }

        $booking->update([
            'status' => 'cancelled',
            'cancelled_by' => $request->user()->id,
            'cancelled_at' => now(),
        ]);

        $notifications->sendToUsers([$request->user()], [
            'title' => 'Booking cancelled',
            'message' => 'Your ferry bus booking has been cancelled.',
            'type' => 'booking',
            'related_trip_id' => $booking->trip_id,
        ]);

        return response()->json([
            'message' => 'Booking cancelled successfully.',
            'data' => $booking->refresh(),
        ]);
    }

    private function abortUnlessOwner(Request $request, Booking $booking): void
    {
        if ($booking->user_id !== $request->user()->id) {
            abort(404);
        }
    }

    private function confirmationMessage(Trip $trip, bool $requiresFleetRebalance): string
    {
        $cycle = "{$trip->trip_date->format('M j')} at ".Carbon::parse($trip->departure_time)->format('g:i A');

        if ($requiresFleetRebalance) {
            return "Your seat is confirmed for {$cycle}. Your bus will be assigned after fleet rebalancing.";
        }

        $busCode = $trip->bus?->bus_code ?? 'TBD';

        return "Your seat is confirmed for {$cycle}. Your bus is confirmed: {$busCode}.";
    }
}
