<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\TripPassengerStatus;
use App\Services\BookingCapacityService;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    public function confirm(
        Request $request,
        Booking $booking,
        BookingCapacityService $capacityService,
        NotificationDispatchService $notifications
    ): JsonResponse {
        $trip = $booking->trip()->with('bus')->firstOrFail();

        if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
            abort(422, 'Only pending bookings can be confirmed.');
        }

        if ($booking->status !== 'confirmed' && ! $capacityService->hasAvailableSeat($trip)) {
            abort(422, 'The assigned bus has no available seats.');
        }

        $booking->update(['status' => 'confirmed']);

        TripPassengerStatus::query()->firstOrCreate([
            'trip_id' => $booking->trip_id,
            'booking_id' => $booking->id,
        ], [
            'passenger_status' => 'waiting',
        ]);

        $notifications->sendToUsers([$booking->user], [
            'created_by' => $request->user()->id,
            'related_trip_id' => $booking->trip_id,
            'title' => 'Booking confirmed',
            'message' => $trip->bus?->bus_code
                ? "Your ferry bus booking has been confirmed. Your bus is confirmed: {$trip->bus->bus_code}."
                : 'Your ferry bus booking has been confirmed.',
            'type' => 'booking',
        ]);

        return response()->json([
            'data' => $booking->refresh()->load(['trip.bus', 'user', 'pickupLocation', 'dropoffLocation', 'passengerStatus']),
        ]);
    }

    public function cancel(Request $request, Booking $booking, NotificationDispatchService $notifications): JsonResponse
    {
        $booking->update([
            'status' => 'cancelled',
            'cancelled_by' => $request->user()->id,
            'cancelled_at' => now(),
        ]);

        $notifications->sendToUsers([$booking->user], [
            'created_by' => $request->user()->id,
            'related_trip_id' => $booking->trip_id,
            'title' => 'Booking cancelled',
            'message' => 'Your ferry bus booking has been cancelled.',
            'type' => 'booking',
        ]);

        return response()->json([
            'message' => 'Booking cancelled successfully.',
            'data' => $booking->refresh(),
        ]);
    }
}
