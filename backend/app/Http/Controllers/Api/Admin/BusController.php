<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Bus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BusController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Bus::query()->orderBy('bus_code')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $bus = Bus::query()->create($this->validatedData($request));

        return response()->json(['data' => $bus], 201);
    }

    public function show(Bus $bus): JsonResponse
    {
        return response()->json(['data' => $bus]);
    }

    public function update(Request $request, Bus $bus): JsonResponse
    {
        $bus->update($this->validatedData($request, $bus));

        return response()->json(['data' => $bus->refresh()]);
    }

    public function destroy(Bus $bus): JsonResponse
    {
        $bus->update(['status' => 'inactive']);

        return response()->json([
            'message' => 'Bus deactivated successfully.',
            'data' => $bus->refresh(),
        ]);
    }

    private function validatedData(Request $request, ?Bus $bus = null): array
    {
        return $request->validate([
            'bus_code' => [
                $bus ? 'sometimes' : 'required',
                'string',
                'max:100',
                Rule::unique('buses', 'bus_code')->ignore($bus),
            ],
            'plate_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('buses', 'plate_number')->ignore($bus),
            ],
            'seat_count' => [$bus ? 'sometimes' : 'required', 'integer', 'min:1', 'max:500'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'maintenance'])],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
