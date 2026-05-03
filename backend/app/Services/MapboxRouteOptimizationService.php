<?php

namespace App\Services;

use App\Models\Trip;
use App\Models\TripRoutePlan;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class MapboxRouteOptimizationService
{
    public function __construct(private TripRouteService $routes)
    {
        //
    }

    public function optimize(Trip $trip, bool $force = false): TripRoutePlan
    {
        $stops = $this->routes->optimizationStopsForTrip($trip);
        $stopsHash = $this->routes->stopsHash($stops);

        $existingPlan = $trip->routePlan;

        if (! $force && $existingPlan && $existingPlan->stops_hash === $stopsHash && $existingPlan->status === 'optimized') {
            return $existingPlan;
        }

        $this->validateStops($stops);

        $token = config('services.mapbox.access_token');

        if (! $token) {
            throw new RuntimeException('Mapbox access token is not configured.');
        }

        $profile = config('services.mapbox.optimization_profile', 'mapbox/driving');
        $coordinateString = $this->coordinateString($stops);
        $requestPayload = [
            'profile' => $profile,
            'coordinate_count' => $stops->count(),
            'coordinates' => $stops->map(fn (array $stop): array => [
                'longitude' => (float) $stop['longitude'],
                'latitude' => (float) $stop['latitude'],
            ])->values()->all(),
            'params' => [
                'geometries' => 'geojson',
                'overview' => 'full',
                'roundtrip' => false,
                'source' => 'first',
                'destination' => 'last',
            ],
        ];

        try {
            $response = Http::timeout(20)
                ->retry(2, 300)
                ->get("https://api.mapbox.com/optimized-trips/v1/{$profile}/{$coordinateString}", [
                    'access_token' => $token,
                    'geometries' => 'geojson',
                    'overview' => 'full',
                    'roundtrip' => 'false',
                    'source' => 'first',
                    'destination' => 'last',
                ])
                ->throw()
                ->json();
        } catch (RequestException $exception) {
            $this->storeFailure($trip, $stops, $stopsHash, $requestPayload, $exception->getMessage());

            throw new RuntimeException('Mapbox route optimization request failed.');
        } catch (Throwable $exception) {
            $this->storeFailure($trip, $stops, $stopsHash, $requestPayload, $exception->getMessage());

            throw new RuntimeException('Mapbox route optimization request failed.');
        }

        if (($response['code'] ?? null) !== 'Ok') {
            $message = $response['message'] ?? $response['code'] ?? 'Mapbox could not optimize this route.';
            $this->storeFailure($trip, $stops, $stopsHash, $requestPayload, $message, $response);

            throw new RuntimeException($message);
        }

        $tripResult = $response['trips'][0] ?? [];

        return TripRoutePlan::query()->updateOrCreate(
            ['trip_id' => $trip->id],
            [
                'provider' => 'mapbox',
                'profile' => $profile,
                'status' => 'optimized',
                'stops_hash' => $stopsHash,
                'input_stops' => $stops->values()->all(),
                'ordered_stops' => $this->orderedStops(
                    $stops,
                    collect($response['waypoints'] ?? []),
                    collect($tripResult['legs'] ?? []),
                )->values()->all(),
                'route_geometry' => $tripResult['geometry'] ?? null,
                'request_payload' => $requestPayload,
                'response_payload' => $response,
                'distance_meters' => isset($tripResult['distance']) ? (int) round($tripResult['distance']) : null,
                'duration_seconds' => isset($tripResult['duration']) ? (int) round($tripResult['duration']) : null,
                'error_message' => null,
                'optimized_at' => now(),
            ]
        );
    }

    private function validateStops(Collection $stops): void
    {
        if ($stops->count() < 2) {
            throw new RuntimeException('At least two route points with latitude and longitude are required.');
        }

        if ($stops->count() > 12) {
            throw new RuntimeException('Mapbox Optimization API supports up to 12 coordinates per request.');
        }
    }

    private function coordinateString(Collection $stops): string
    {
        return $stops
            ->map(fn (array $stop): string => "{$stop['longitude']},{$stop['latitude']}")
            ->implode(';');
    }

    private function orderedStops(Collection $stops, Collection $waypoints, Collection $legs): Collection
    {
        $sorted = $stops
            ->values()
            ->map(function (array $stop, int $index) use ($waypoints): array {
                $waypoint = $waypoints->get($index, []);

                return [
                    ...$stop,
                    'optimized_order' => $waypoint['waypoint_index'] ?? $index,
                    'snapped_name' => $waypoint['name'] ?? null,
                    'snapped_location' => $waypoint['location'] ?? null,
                ];
            })
            ->sortBy('optimized_order')
            ->values();

        $cumulativeSeconds = 0;

        return $sorted->map(function (array $stop, int $index) use ($legs, &$cumulativeSeconds): array {
            $offset = $cumulativeSeconds;
            $leg = $legs->get($index);
            if ($leg !== null) {
                $cumulativeSeconds += (int) round($leg['duration'] ?? 0);
            }

            return [
                ...$stop,
                'sequence' => $index + 1,
                'estimated_arrival_offset_seconds' => $offset,
            ];
        });
    }

    private function storeFailure(
        Trip $trip,
        Collection $stops,
        string $stopsHash,
        array $requestPayload,
        string $message,
        ?array $response = null
    ): TripRoutePlan {
        return TripRoutePlan::query()->updateOrCreate(
            ['trip_id' => $trip->id],
            [
                'provider' => 'mapbox',
                'profile' => config('services.mapbox.optimization_profile', 'mapbox/driving'),
                'status' => 'failed',
                'stops_hash' => $stopsHash,
                'input_stops' => $stops->values()->all(),
                'ordered_stops' => null,
                'route_geometry' => null,
                'request_payload' => $requestPayload,
                'response_payload' => $response,
                'distance_meters' => null,
                'duration_seconds' => null,
                'error_message' => $message,
                'optimized_at' => now(),
            ]
        );
    }
}
