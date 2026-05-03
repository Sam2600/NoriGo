<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bus extends Model
{
    use HasFactory;

    protected $fillable = [
        'bus_code',
        'plate_number',
        'seat_count',
        'status',
        'notes',
    ];

    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class);
    }
}
