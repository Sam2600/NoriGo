<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Location::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $location = Location::query()->create($this->validatedData($request));

        return response()->json(['data' => $location], 201);
    }

    public function show(Location $location): JsonResponse
    {
        return response()->json(['data' => $location]);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $location->update($this->validatedData($request, $location, partial: true));

        return response()->json(['data' => $location->refresh()]);
    }

    public function destroy(Location $location): JsonResponse
    {
        $location->delete();

        return response()->json(['message' => 'Location deleted successfully.']);
    }

    private function validatedData(Request $request, ?Location $location = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255', Rule::unique('locations', 'name')->ignore($location)],
            'address' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
    }
}
