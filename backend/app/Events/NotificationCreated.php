<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationCreated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public Notification $notification)
    {
        $this->notification->loadMissing(['relatedTrip']);
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("users.{$this->notification->user_id}.notifications"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.created';
    }

    public function broadcastWith(): array
    {
        return [
            'notification' => $this->notification->toArray(),
        ];
    }
}
