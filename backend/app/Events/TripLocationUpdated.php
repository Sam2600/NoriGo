<?php

namespace App\Events;

use App\Models\TripLocationUpdate;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TripLocationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public TripLocationUpdate $locationUpdate)
    {
        $this->locationUpdate->loadMissing(['trip.bus', 'trip.driver']);
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("trips.{$this->locationUpdate->trip_id}"),
            new Channel('admin.operations'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'trip.location.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'location' => $this->locationUpdate->toArray(),
            'trip' => $this->locationUpdate->trip->toArray(),
        ];
    }
}
