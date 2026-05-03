<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TripRoutePlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'trip_id',
        'provider',
        'profile',
        'status',
        'stops_hash',
        'input_stops',
        'ordered_stops',
        'route_geometry',
        'request_payload',
        'response_payload',
        'distance_meters',
        'duration_seconds',
        'error_message',
        'optimized_at',
    ];

    protected function casts(): array
    {
        return [
            'input_stops' => 'array',
            'ordered_stops' => 'array',
            'route_geometry' => 'array',
            'request_payload' => 'array',
            'response_payload' => 'array',
            'distance_meters' => 'integer',
            'duration_seconds' => 'integer',
            'optimized_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }
}
