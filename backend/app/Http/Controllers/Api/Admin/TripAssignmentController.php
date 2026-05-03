<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\FleetAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TripAssignmentController extends Controller
{
    public function rebalance(Request $request, FleetAssignmentService $assignments): JsonResponse
    {
        $validated = $request->validate([
            'trip_ids' => ['required', 'array', 'min:2'],
            'trip_ids.*' => ['integer', 'exists:trips,id'],
            'apply' => ['sometimes', 'boolean'],
        ]);

        $data = ($validated['apply'] ?? false)
            ? $assignments->apply($validated['trip_ids'], $request->user())
            : $assignments->preview($validated['trip_ids']);

        return response()->json([
            'message' => $data['applied']
                ? 'Fleet assignments rebalanced successfully.'
                : 'Fleet assignment preview generated successfully.',
            'data' => $data,
        ]);
    }

    public function notifyBusAssignments(Request $request, FleetAssignmentService $assignments): JsonResponse
    {
        $validated = $request->validate([
            'trip_ids' => ['required', 'array', 'min:1'],
            'trip_ids.*' => ['integer', 'exists:trips,id'],
        ]);

        $data = $assignments->notifyBusAssignments($validated['trip_ids'], $request->user());

        return response()->json([
            'message' => "Bus assignment notifications sent to {$data['sent_count']} passengers.",
            'data' => $data,
        ]);
    }
}
