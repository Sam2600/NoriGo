<?php

namespace App\Events;

use App\Models\Trip;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TripStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public Trip $trip)
    {
        $this->trip->loadMissing(['bus', 'driver', 'latestLocation']);
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("trips.{$this->trip->id}"),
            new Channel('admin.operations'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'trip.status.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'trip' => $this->trip->toArray(),
        ];
    }
}
