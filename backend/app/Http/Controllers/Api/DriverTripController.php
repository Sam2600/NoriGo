<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Trip;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DriverTripController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Trip::query()
                ->with(['bus', 'routeStartLocation', 'routeEndLocation'])
                ->where('driver_id', $request->user()->id)
                ->whereIn('status', ['scheduled', 'started'])
                ->orderBy('trip_date')
                ->orderBy('departure_time')
                ->get(),
        ]);
    }

    public function show(Request $request, Trip $trip): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        return response()->json([
            'data' => $trip->load([
                'bus',
                'routeStartLocation',
                'routeEndLocation',
                'bookings.user',
                'bookings.pickupLocation',
                'bookings.dropoffLocation',
                'bookings.passengerStatus',
            ]),
        ]);
    }

    public function start(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        if ($trip->status !== 'scheduled') {
            abort(422, 'Only scheduled trips can be started.');
        }

        if ($trip->trip_date->toDateString() > now(config('app.operations_timezone', 'Asia/Yangon'))->toDateString()) {
            abort(422, 'Trip can only be initialized on its cycle date.');
        }

        $trip->update([
            'status' => 'started',
            'started_at' => now(),
        ]);

        $notifications->sendToTripPassengers($trip->refresh()->loadMissing('driver'), [
            'title' => 'Trip started',
            'message' => 'Your ferry bus trip has started.',
            'type' => 'trip_reminder',
        ], includeDriver: false);

        return response()->json([
            'data' => $trip->refresh(),
        ]);
    }

    public function updatePassengerStatus(Request $request, Trip $trip, Booking $booking): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        if ($booking->trip_id !== $trip->id) {
            abort(404);
        }

        $validated = $request->validate([
            'passenger_status' => ['required', Rule::in(['waiting', 'picked_up', 'absent', 'dropped_off'])],
        ]);

        $booking->passengerStatus()->updateOrCreate(
            ['trip_id' => $trip->id],
            [
                'passenger_status' => $validated['passenger_status'],
                'updated_by' => $request->user()->id,
            ]
        );

        if ($validated['passenger_status'] === 'absent') {
            $booking->update(['status' => 'missed']);
        }

        return response()->json([
            'data' => $booking->refresh()->load('passengerStatus'),
        ]);
    }

    public function complete(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        if ($trip->status !== 'started') {
            abort(422, 'Only started trips can be completed.');
        }

        $trip->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $trip->bookings()
            ->where('status', 'confirmed')
            ->update(['status' => 'completed']);

        $notifications->sendToTripPassengers($trip->refresh()->loadMissing('driver'), [
            'title' => 'Trip completed',
            'message' => 'Your ferry bus trip has been completed.',
            'type' => 'trip_reminder',
        ], includeDriver: false);

        return response()->json([
            'data' => $trip->refresh(),
        ]);
    }

    private function abortUnlessAssigned(Request $request, Trip $trip): void
    {
        if ($trip->driver_id !== $request->user()->id) {
            abort(404);
        }
    }
}
