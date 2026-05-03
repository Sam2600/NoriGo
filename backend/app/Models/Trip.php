<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trip extends Model
{
    use HasFactory;

    protected $appends = [
        'duration_minutes',
    ];

    protected $fillable = [
        'trip_date',
        'departure_time',
        'direction',
        'confirmation_deadline',
        'bus_id',
        'driver_id',
        'route_start_location_id',
        'route_end_location_id',
        'status',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'trip_date' => 'date',
            'confirmation_deadline' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function bus(): BelongsTo
    {
        return $this->belongsTo(Bus::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function routeStartLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'route_start_location_id');
    }

    public function routeEndLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'route_end_location_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function passengerStatuses(): HasMany
    {
        return $this->hasMany(TripPassengerStatus::class);
    }

    public function getDurationMinutesAttribute(): ?int
    {
        if (! $this->started_at || ! $this->completed_at) {
            return null;
        }

        return (int) round($this->started_at->diffInMinutes($this->completed_at));
    }
}
