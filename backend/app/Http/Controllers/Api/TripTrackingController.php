<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Trip;
use App\Services\TripRouteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TripTrackingController extends Controller
{
    public function __construct(private TripRouteService $routes)
    {
        //
    }

    public function active(Request $request): JsonResponse
    {
        $booking = $request->user()
            ->bookings()
            ->where('status', 'confirmed')
            ->whereHas('trip', fn ($query) => $query
                ->whereIn('status', ['scheduled', 'started'])
                ->whereDate('trip_date', '>=', now()->subDay()->toDateString()))
            ->with([
                'pickupLocation',
                'dropoffLocation',
                'trip.bus',
                'trip.driver',
                'trip.latestLocation',
                'trip.issueReports' => fn ($query) => $query->latest('reported_at')->limit(5),
            ])
            ->latest('updated_at')
            ->first();

        if (! $booking) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => $this->trackingPayload($booking->trip, $booking),
        ]);
    }

    public function show(Request $request, Trip $trip): JsonResponse
    {
        $user = $request->user()->loadMissing('role');
        $booking = null;

        if ($user->role?->name === 'admin') {
            $isAllowed = true;
        } elseif ($user->role?->name === 'driver') {
            $isAllowed = $trip->driver_id === $user->id;
        } else {
            $booking = $trip->bookings()
                ->where('user_id', $user->id)
                ->where('status', 'confirmed')
                ->with(['pickupLocation', 'dropoffLocation'])
                ->first();
            $isAllowed = (bool) $booking;
        }

        abort_unless($isAllowed, 404);

        return response()->json([
            'data' => $this->trackingPayload($trip, $booking),
        ]);
    }

    private function trackingPayload(Trip $trip, mixed $booking = null): array
    {
        $trip->loadMissing([
            'bus',
            'driver',
            'latestLocation',
            'issueReports' => fn ($query) => $query->latest('reported_at')->limit(5),
        ]);
        [$routeStops, $routeGeometry] = $this->routePlanPayload($trip);

        if ($booking) {
            $routeStops = $this->publicRouteStops($routeStops);
        }

        $trip->unsetRelation('bookings');
        $trip->unsetRelation('routePlan');

        $history = $trip->locationUpdates()
            ->latest('reported_at')
            ->limit(30)
            ->get()
            ->reverse()
            ->values();

        return [
            'booking' => $booking,
            'trip' => $trip,
            'latest_location' => $trip->latestLocation,
            'location_history' => $history,
            'route_stops' => $routeStops,
            'route_geometry' => $routeGeometry,
            'open_issues' => $trip->issueReports->where('status', 'open')->values(),
        ];
    }

    private function routePlanPayload(Trip $trip): array
    {
        $trip->loadMissing([
            'routePlan',
            'bookings.user',
            'bookings.pickupLocation',
            'bookings.dropoffLocation',
        ]);

        $suggestedStops = $this->routes->optimizationStopsForTrip($trip);
        $routePlan = $trip->routePlan;
        $hasCurrentOptimizedPlan = $routePlan
            && $routePlan->status === 'optimized'
            && $routePlan->ordered_stops
            && $routePlan->stops_hash === $this->routes->stopsHash($suggestedStops);

        if ($hasCurrentOptimizedPlan) {
            return [$routePlan->ordered_stops, $routePlan->route_geometry];
        }

        return [$suggestedStops, null];
    }

    private function publicRouteStops(mixed $stops): mixed
    {
        return collect($stops)
            ->map(fn (array $stop): array => collect($stop)
                ->except([
                    'booking_id',
                    'booking_ids',
                    'passenger_name',
                    'passenger_names',
                    'passenger_status',
                ])
                ->all())
            ->values();
    }
}
