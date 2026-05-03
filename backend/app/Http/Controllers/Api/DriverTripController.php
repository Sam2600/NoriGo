<?php

namespace App\Http\Controllers\Api;

use App\Events\DriverIssueReported;
use App\Events\TripLocationUpdated;
use App\Events\TripStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\DriverIssueReport;
use App\Models\Trip;
use App\Models\TripLocationUpdate;
use App\Models\User;
use App\Services\NotificationDispatchService;
use App\Services\TripRouteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DriverTripController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Trip::query()
                ->with(['bus', 'latestLocation', 'routeStartLocation', 'routeEndLocation'])
                ->where('driver_id', $request->user()->id)
                ->whereIn('status', ['scheduled', 'started'])
                ->orderBy('trip_date')
                ->orderBy('departure_time')
                ->get(),
        ]);
    }

    public function show(Request $request, Trip $trip, TripRouteService $routes): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        $trip->load([
            'bus',
            'routeStartLocation',
            'routeEndLocation',
            'bookings.user',
            'bookings.pickupLocation',
            'bookings.dropoffLocation',
            'bookings.passengerStatus',
            'latestLocation',
            'routePlan',
            'issueReports' => fn ($query) => $query->latest('reported_at')->limit(10),
        ]);
        $trip->setAttribute('route_stops', $routes->stopsForTrip($trip));

        return response()->json([
            'data' => $trip,
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
            'operational_status' => 'on_the_way',
            'last_status_update_at' => now(),
            'started_at' => now(),
        ]);

        $trip->loadMissing(['driver', 'bookings.user']);
        $notifications->sendToTripPassengers($trip, [
            'title' => 'Bus is on the way',
            'message' => 'Your ferry bus trip has started.',
            'type' => 'trip_reminder',
            'priority' => 'normal',
        ], includeDriver: false);
        event(new TripStatusUpdated($trip->refresh()));

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

    public function updateLocation(Request $request, Trip $trip): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        if (! in_array($trip->status, ['scheduled', 'started'], true)) {
            abort(422, 'Only active trips can receive location updates.');
        }

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'speed_kmh' => ['nullable', 'numeric', 'min:0', 'max:180'],
            'accuracy_meters' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'eta_at' => ['nullable', 'date'],
            'reported_at' => ['nullable', 'date'],
        ]);

        $locationUpdate = TripLocationUpdate::query()->create([
            'trip_id' => $trip->id,
            'driver_id' => $request->user()->id,
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'heading' => $validated['heading'] ?? null,
            'speed_kmh' => $validated['speed_kmh'] ?? null,
            'accuracy_meters' => $validated['accuracy_meters'] ?? null,
            'eta_at' => $validated['eta_at'] ?? null,
            'reported_at' => $validated['reported_at'] ?? now(),
        ]);

        if (! empty($validated['eta_at'])) {
            $trip->update(['eta_at' => $validated['eta_at']]);
        }

        event(new TripLocationUpdated($locationUpdate));

        return response()->json([
            'data' => $locationUpdate->load(['trip.bus', 'driver']),
        ], 201);
    }

    public function updateStatus(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        $validated = $request->validate([
            'operational_status' => ['required', Rule::in(['on_the_way', 'delayed', 'arrived_at_pickup', 'completed'])],
            'delay_minutes' => ['nullable', 'integer', 'min:0', 'max:720'],
            'eta_at' => ['nullable', 'date'],
            'status_note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($trip->status === 'cancelled') {
            abort(422, 'Cancelled trips cannot be updated.');
        }

        $updates = [
            'status' => $validated['operational_status'] === 'completed' ? 'completed' : 'started',
            'operational_status' => $validated['operational_status'],
            'delay_minutes' => $validated['operational_status'] === 'delayed'
                ? ($validated['delay_minutes'] ?? $trip->delay_minutes ?? 0)
                : 0,
            'eta_at' => $validated['eta_at'] ?? $trip->eta_at,
            'status_note' => $validated['status_note'] ?? null,
            'last_status_update_at' => now(),
        ];

        if (! $trip->started_at) {
            $updates['started_at'] = now();
        }

        if ($validated['operational_status'] === 'completed') {
            $updates['completed_at'] = $trip->completed_at ?? now();
        }

        $trip->update($updates);

        if ($validated['operational_status'] === 'completed') {
            $trip->bookings()
                ->where('status', 'confirmed')
                ->update(['status' => 'completed']);
        }

        $this->notifyForOperationalStatus($trip->refresh(), $notifications);
        event(new TripStatusUpdated($trip));

        return response()->json([
            'data' => $trip->load(['bus', 'latestLocation']),
        ]);
    }

    public function reportIssue(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        $validated = $request->validate([
            'issue_type' => ['required', Rule::in(['delay', 'vehicle', 'passenger', 'route', 'emergency', 'other'])],
            'severity' => ['required', Rule::in(['low', 'medium', 'high', 'critical'])],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $issue = DriverIssueReport::query()->create([
            'trip_id' => $trip->id,
            'driver_id' => $request->user()->id,
            'issue_type' => $validated['issue_type'],
            'severity' => $validated['severity'],
            'title' => $validated['title'],
            'message' => $validated['message'],
            'reported_at' => now(),
        ]);

        $admins = User::query()
            ->where('status', 'active')
            ->whereHas('role', fn ($query) => $query->where('name', 'admin'))
            ->get();

        $notifications->sendToUsers($admins, [
            'related_trip_id' => $trip->id,
            'title' => "Driver issue: {$validated['title']}",
            'message' => $validated['message'],
            'type' => $validated['issue_type'] === 'emergency' ? 'emergency' : 'issue',
            'priority' => in_array($validated['severity'], ['high', 'critical'], true) ? 'urgent' : 'high',
        ]);

        event(new DriverIssueReported($issue));

        return response()->json([
            'data' => $issue->load(['trip.bus', 'driver']),
        ], 201);
    }

    public function complete(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        if ($trip->status !== 'started') {
            abort(422, 'Only started trips can be completed.');
        }

        $trip->update([
            'status' => 'completed',
            'operational_status' => 'completed',
            'last_status_update_at' => now(),
            'completed_at' => now(),
        ]);

        $trip->bookings()
            ->where('status', 'confirmed')
            ->update(['status' => 'completed']);

        $notifications->sendToTripPassengers($trip->refresh(), [
            'title' => 'Trip completed',
            'message' => 'Your ferry bus trip has been completed.',
            'type' => 'trip_reminder',
            'priority' => 'normal',
        ], includeDriver: false);
        event(new TripStatusUpdated($trip));

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

    private function notifyForOperationalStatus(Trip $trip, NotificationDispatchService $notifications): void
    {
        $messages = [
            'on_the_way' => [
                'title' => 'Bus is on the way',
                'message' => 'Your ferry bus is on the way.',
                'type' => 'trip_reminder',
                'priority' => 'normal',
            ],
            'delayed' => [
                'title' => 'Bus delayed',
                'message' => "Your ferry bus is delayed by {$trip->delay_minutes} minutes.",
                'type' => 'delay',
                'priority' => 'high',
            ],
            'arrived_at_pickup' => [
                'title' => 'Bus arrived at pickup',
                'message' => 'Your ferry bus has arrived at the pickup point.',
                'type' => 'trip_reminder',
                'priority' => 'high',
            ],
            'completed' => [
                'title' => 'Trip completed',
                'message' => 'Your ferry bus trip has been completed.',
                'type' => 'trip_reminder',
                'priority' => 'normal',
            ],
        ];

        $payload = $messages[$trip->operational_status] ?? null;

        if (! $payload) {
            return;
        }

        $notifications->sendToTripPassengers($trip, $payload, includeDriver: false);
    }
}
