<?php

use App\Http\Controllers\Api\Admin\BookingController as AdminBookingController;
use App\Http\Controllers\Api\Admin\BusController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\DriverController;
use App\Http\Controllers\Api\Admin\TripController as AdminTripController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\DriverTripController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\TripController;
use App\Http\Controllers\Api\UserProfileController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/locations', [LocationController::class, 'index']);
    Route::get('/locations/{location}', [LocationController::class, 'show']);

    Route::get('/profile', [UserProfileController::class, 'show']);
    Route::put('/profile', [UserProfileController::class, 'update']);

    Route::get('/trips/upcoming', [TripController::class, 'upcoming']);
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/bookings/{booking}', [BookingController::class, 'show']);
    Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
});

Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function (): void {
    Route::get('/dashboard', DashboardController::class);
    Route::get('/roles', [RoleController::class, 'index']);

    Route::post('/locations', [LocationController::class, 'store']);
    Route::put('/locations/{location}', [LocationController::class, 'update']);
    Route::delete('/locations/{location}', [LocationController::class, 'destroy']);

    Route::apiResource('buses', BusController::class);
    Route::apiResource('drivers', DriverController::class);
    Route::post('/trips/bulk', [AdminTripController::class, 'bulkStore']);
    Route::get('/trips/{trip}/bookings', [AdminTripController::class, 'bookings']);
    Route::post('/trips/{trip}/cancel', [AdminTripController::class, 'cancel']);
    Route::apiResource('trips', AdminTripController::class);
    Route::post('/bookings/{booking}/confirm', [AdminBookingController::class, 'confirm']);
    Route::post('/bookings/{booking}/cancel', [AdminBookingController::class, 'cancel']);
});

Route::middleware(['auth:sanctum', 'role:driver'])->prefix('driver')->group(function (): void {
    Route::get('/trips', [DriverTripController::class, 'index']);
    Route::get('/trips/{trip}', [DriverTripController::class, 'show']);
    Route::post('/trips/{trip}/start', [DriverTripController::class, 'start']);
    Route::post('/trips/{trip}/passengers/{booking}/status', [DriverTripController::class, 'updatePassengerStatus']);
    Route::post('/trips/{trip}/complete', [DriverTripController::class, 'complete']);
});
