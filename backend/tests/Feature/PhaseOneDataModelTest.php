<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Bus;
use App\Models\DriverProfile;
use App\Models\Location;
use App\Models\Notification;
use App\Models\Role;
use App\Models\Trip;
use App\Models\TripPassengerStatus;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseOneDataModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_phase_one_core_records_can_be_related(): void
    {
        $userRole = Role::query()->where('name', 'user')->firstOrFail();
        $driverRole = Role::query()->where('name', 'driver')->firstOrFail();

        $passenger = User::factory()->create(['role_id' => $userRole->id]);
        $driver = User::factory()->create(['role_id' => $driverRole->id]);

        $pickup = Location::query()->create([
            'name' => 'Hledan',
            'address' => 'Hledan Junction',
            'latitude' => 16.8219000,
            'longitude' => 96.1301000,
        ]);

        $dropoff = Location::query()->create([
            'name' => 'Office',
            'address' => 'Main Office',
        ]);

        UserProfile::query()->create([
            'user_id' => $passenger->id,
            'phone' => '09123456789',
            'default_pickup_location_id' => $pickup->id,
            'default_dropoff_location_id' => $dropoff->id,
        ]);

        DriverProfile::query()->create([
            'user_id' => $driver->id,
            'license_no' => 'DRV-001',
        ]);

        $bus = Bus::query()->create([
            'bus_code' => 'BUS-01',
            'seat_count' => 24,
        ]);

        $trip = Trip::query()->create([
            'trip_date' => now()->toDateString(),
            'departure_time' => '07:30:00',
            'direction' => 'pickup',
            'confirmation_deadline' => now()->addHours(2),
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
        ]);

        $booking = Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passenger->id,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'status' => 'confirmed',
        ]);

        TripPassengerStatus::query()->create([
            'trip_id' => $trip->id,
            'booking_id' => $booking->id,
            'passenger_status' => 'waiting',
            'updated_by' => $driver->id,
        ]);

        Notification::query()->create([
            'user_id' => $passenger->id,
            'title' => 'Booking confirmed',
            'message' => 'Your morning pickup booking is confirmed.',
            'type' => 'booking',
        ]);

        $this->assertSame('user', $passenger->fresh('role')->role->name);
        $this->assertSame('Hledan', $passenger->profile->defaultPickupLocation->name);
        $this->assertSame('BUS-01', $trip->fresh('bus')->bus->bus_code);
        $this->assertSame('confirmed', $trip->bookings()->first()->status);
        $this->assertSame('waiting', $booking->passengerStatus->passenger_status);
        $this->assertSame(1, $passenger->notifications()->count());
    }
}
