<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Trip;
use App\Services\MapboxRouteOptimizationService;
use App\Services\TripRouteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class DriverRoutePlanController extends Controller
{
    public function show(Request $request, Trip $trip, TripRouteService $routes): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);
        $suggestedStops = $routes->optimizationStopsForTrip($trip);
        $routePlan = $trip->routePlan;

        return response()->json([
            'data' => [
                'route_plan' => $routePlan,
                'suggested_stops' => $suggestedStops,
                'is_stale' => $routePlan
                    ? $routePlan->stops_hash !== $routes->stopsHash($suggestedStops)
                    : false,
            ],
        ]);
    }

    public function optimize(Request $request, Trip $trip, MapboxRouteOptimizationService $optimizer): JsonResponse
    {
        $this->abortUnlessAssigned($request, $trip);

        $validated = $request->validate([
            'force' => ['sometimes', 'boolean'],
        ]);

        try {
            $plan = $optimizer->optimize($trip->loadMissing('routePlan'), (bool) ($validated['force'] ?? false));
        } catch (RuntimeException $exception) {
            abort(422, $exception->getMessage());
        }

        return response()->json([
            'data' => $plan->refresh(),
        ]);
    }

    private function abortUnlessAssigned(Request $request, Trip $trip): void
    {
        if ($trip->driver_id !== $request->user()->id) {
            abort(404);
        }
    }
}
