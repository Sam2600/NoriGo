<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Trip;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Notification::query()
                ->with(['user.role', 'creator', 'relatedTrip.bus'])
                ->latest()
                ->limit(200)
                ->get(),
        ]);
    }

    public function store(Request $request, NotificationDispatchService $notifications): JsonResponse
    {
        $validated = $request->validate([
            'audience' => ['required', Rule::in(['all', 'admin', 'driver', 'user', 'trip', 'single_user'])],
            'user_id' => ['required_if:audience,single_user', 'nullable', 'integer', 'exists:users,id'],
            'trip_id' => ['required_if:audience,trip', 'nullable', 'integer', 'exists:trips,id'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
            'type' => ['required', Rule::in([
                'system',
                'booking',
                'trip_reminder',
                'delay',
                'schedule_change',
                'cancellation',
                'issue',
                'emergency',
            ])],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'expires_at' => ['nullable', 'date'],
        ]);

        $payload = [
            'created_by' => $request->user()->id,
            'related_trip_id' => $validated['trip_id'] ?? null,
            'title' => $validated['title'],
            'message' => $validated['message'],
            'type' => $validated['type'],
            'priority' => $validated['priority'] ?? 'normal',
            'expires_at' => $validated['expires_at'] ?? null,
        ];

        if ($validated['audience'] === 'trip') {
            $trip = Trip::query()->with(['driver'])->findOrFail($validated['trip_id']);
            $created = $notifications->sendToTripPassengers($trip, $payload);
        } else {
            $created = $notifications->sendToUsers($this->recipients($validated), $payload);
        }

        return response()->json([
            'message' => "{$created->count()} notifications created.",
            'data' => $created,
            'meta' => [
                'created_count' => $created->count(),
            ],
        ], 201);
    }

    private function recipients(array $validated): iterable
    {
        if ($validated['audience'] === 'single_user') {
            return User::query()->whereKey($validated['user_id'])->get();
        }

        if ($validated['audience'] === 'all') {
            return User::query()->where('status', 'active')->get();
        }

        return User::query()
            ->where('status', 'active')
            ->whereHas('role', fn ($query) => $query->where('name', $validated['audience']))
            ->get();
    }
}
