<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'address',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function pickupProfiles(): HasMany
    {
        return $this->hasMany(UserProfile::class, 'default_pickup_location_id');
    }

    public function dropoffProfiles(): HasMany
    {
        return $this->hasMany(UserProfile::class, 'default_dropoff_location_id');
    }

    public function pickupBookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'pickup_location_id');
    }

    public function dropoffBookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'dropoff_location_id');
    }
}
