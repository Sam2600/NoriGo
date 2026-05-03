<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'phone',
        'default_pickup_location_id',
        'default_dropoff_location_id',
        'notes',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function defaultPickupLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'default_pickup_location_id');
    }

    public function defaultDropoffLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'default_dropoff_location_id');
    }
}
