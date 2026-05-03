<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Location::query()
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $location = Location::query()->create($this->validatedData($request));

        return response()->json([
            'data' => $location,
        ], 201);
    }

    public function show(Location $location): JsonResponse
    {
        return response()->json([
            'data' => $location,
        ]);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $location->update($this->validatedData($request, $location, partial: true));

        return response()->json([
            'data' => $location->refresh(),
        ]);
    }

    public function destroy(Location $location): JsonResponse
    {
        $location->delete();

        return response()->json([
            'message' => 'Location deleted successfully.',
        ]);
    }

    private function validatedData(Request $request, ?Location $location = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $validated = $request->validate([
            'name' => [$required, 'string', 'max:255', Rule::unique('locations', 'name')->ignore($location)],
            'address' => ['nullable', 'string'],
            'latitude' => [$required, 'numeric', 'between:-90,90'],
            'longitude' => [$required, 'numeric', 'between:-180,180'],
        ]);

        $latitude = $validated['latitude'] ?? $location?->latitude;
        $longitude = $validated['longitude'] ?? $location?->longitude;

        if ($latitude !== null && $longitude !== null) {
            $coordinateExists = Location::query()
                ->where('latitude', $latitude)
                ->where('longitude', $longitude)
                ->when($location, fn ($query) => $query->whereKeyNot($location->id))
                ->exists();

            if ($coordinateExists) {
                throw ValidationException::withMessages([
                    'latitude' => 'A location with these coordinates already exists.',
                    'longitude' => 'A location with these coordinates already exists.',
                ]);
            }
        }

        return $validated;
    }
}
