<?php

namespace App\Events;

use App\Models\DriverIssueReport;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DriverIssueReported implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public DriverIssueReport $issueReport)
    {
        $this->issueReport->loadMissing(['trip.bus', 'driver']);
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('admin.operations'),
            new Channel("trips.{$this->issueReport->trip_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'driver.issue.reported';
    }

    public function broadcastWith(): array
    {
        return [
            'issue' => $this->issueReport->toArray(),
        ];
    }
}
