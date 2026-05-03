<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DriverIssueReport;
use App\Models\Trip;
use App\Services\TripRouteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationController extends Controller
{
    public function index(TripRouteService $routes): JsonResponse
    {
        $activeTrips = Trip::query()
            ->with([
                'bus',
                'driver',
                'latestLocation',
                'bookings.user',
                'bookings.pickupLocation',
                'bookings.dropoffLocation',
            ])
            ->withCount([
                'bookings',
                'bookings as confirmed_bookings_count' => fn ($query) => $query->where('status', 'confirmed'),
                'issueReports as open_issues_count' => fn ($query) => $query->where('status', 'open'),
            ])
            ->whereIn('status', ['scheduled', 'started'])
            ->whereDate('trip_date', today())
            ->orderBy('trip_date')
            ->orderBy('departure_time')
            ->get();

        $activeTrips->each(function (Trip $trip) use ($routes): void {
            $trip->setAttribute('route_stops', $routes->stopsForTrip($trip));
        });

        $openIssues = DriverIssueReport::query()
            ->with(['trip.bus', 'driver'])
            ->where('status', 'open')
            ->latest('reported_at')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => [
                'metrics' => [
                    'active_trips' => $activeTrips->count(),
                    'delayed_trips' => $activeTrips->where('operational_status', 'delayed')->count(),
                    'tracked_trips' => $activeTrips->whereNotNull('latestLocation')->count(),
                    'open_issues' => $openIssues->count(),
                    'emergency_cancellations' => Trip::query()
                        ->where('is_emergency_cancelled', true)
                        ->whereDate('cancelled_at', '>=', now()->subDays(7)->toDateString())
                        ->count(),
                ],
                'trips' => $activeTrips,
                'open_issues' => $openIssues,
            ],
        ]);
    }

    public function resolveIssue(Request $request, DriverIssueReport $issue): JsonResponse
    {
        $validated = $request->validate([
            'resolution_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $issue->update([
            'status' => 'resolved',
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
            'resolution_note' => $validated['resolution_note'] ?? null,
        ]);

        return response()->json([
            'data' => $issue->refresh()->load(['trip.bus', 'driver', 'resolver']),
        ]);
    }
}
