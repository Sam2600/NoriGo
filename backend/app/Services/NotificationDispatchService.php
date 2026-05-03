<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class NotificationDispatchService
{
    /**
     * @param  EloquentCollection<int, User>|Collection<int, User>|array<int, User>  $recipients
     * @return Collection<int, Notification>
     */
    public function sendToUsers(iterable $recipients, array $payload): Collection
    {
        return collect($recipients)
            ->unique('id')
            ->filter(fn (User $user): bool => $user->status === 'active')
            ->map(fn (User $user): Notification => Notification::query()->create([
                'user_id' => $user->id,
                'created_by' => $payload['created_by'] ?? null,
                'related_trip_id' => $payload['related_trip_id'] ?? null,
                'title' => $payload['title'],
                'message' => $payload['message'],
                'type' => $payload['type'] ?? 'system',
                'priority' => $payload['priority'] ?? 'normal',
                'expires_at' => $payload['expires_at'] ?? null,
            ]))
            ->values();
    }

    public function sendToTripPassengers(Trip $trip, array $payload, bool $includeDriver = true): Collection
    {
        $passengers = $trip->bookings()
            ->whereIn('status', ['pending', 'confirmed'])
            ->with('user')
            ->get()
            ->pluck('user')
            ->filter();

        if ($includeDriver && $trip->driver) {
            $passengers->push($trip->driver);
        }

        return $this->sendToUsers($passengers, [
            ...$payload,
            'related_trip_id' => $payload['related_trip_id'] ?? $trip->id,
        ]);
    }
}
