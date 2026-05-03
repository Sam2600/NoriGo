<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TripLocationUpdate extends Model
{
    use HasFactory;

    protected $fillable = [
        'trip_id',
        'driver_id',
        'latitude',
        'longitude',
        'heading',
        'speed_kmh',
        'accuracy_meters',
        'eta_at',
        'reported_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'heading' => 'decimal:2',
            'speed_kmh' => 'decimal:2',
            'accuracy_meters' => 'decimal:2',
            'eta_at' => 'datetime',
            'reported_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }
}
