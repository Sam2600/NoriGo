<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Bus;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'active_buses' => Bus::query()->where('status', 'active')->count(),
                'active_drivers' => User::query()->whereHas('role', fn ($query) => $query->where('name', 'driver'))
                    ->where('status', 'active')
                    ->count(),
                'scheduled_trips' => Trip::query()->where('status', 'scheduled')->count(),
                'pending_bookings' => Booking::query()->where('status', 'pending')->count(),
                'confirmed_bookings' => Booking::query()->where('status', 'confirmed')->count(),
            ],
        ]);
    }
}
