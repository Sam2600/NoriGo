<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Bus;
use App\Models\Location;
use App\Models\Role;
use App\Models\Trip;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CoreWorkflowApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admin_cannot_manage_admin_resources(): void
    {
        Sanctum::actingAs($this->userWithRole('user'));

        $this->postJson('/api/admin/buses', [
            'bus_code' => 'BUS-01',
            'seat_count' => 24,
        ])->assertForbidden();
    }

    public function test_admin_can_create_core_operation_records(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $startId = $this->postJson('/api/admin/locations', [
            'name' => 'Hledan',
            'address' => 'Hledan Junction',
            'latitude' => 16.8219000,
            'longitude' => 96.1301000,
        ])->assertCreated()->json('data.id');
        $endId = $this->postJson('/api/admin/locations', [
            'name' => 'Pearl Condo',
            'address' => 'Pearl Condo',
            'latitude' => 16.8173200,
            'longitude' => 96.1568310,
        ])->assertCreated()->json('data.id');

        $busId = $this->postJson('/api/admin/buses', [
            'bus_code' => 'BUS-01',
            'plate_number' => 'YGN-1234',
            'seat_count' => 24,
        ])->assertCreated()->json('data.id');

        $driverId = $this->postJson('/api/admin/drivers', [
            'name' => 'Aung Min',
            'email' => 'driver@example.com',
            'password' => 'password123',
            'license_no' => 'DRV-001',
        ])->assertCreated()->json('data.id');

        $this->postJson('/api/admin/trips', [
            'date_from' => now()->addDay()->toDateString(),
            'date_to' => now()->addDay()->toDateString(),
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'bus_id' => $busId,
            'driver_id' => $driverId,
            'route_start_location_id' => $startId,
            'route_end_location_id' => $endId,
        ])
            ->assertCreated()
            ->assertJsonPath('data.0.bus_id', $busId)
            ->assertJsonPath('data.0.driver_id', $driverId)
            ->assertJsonPath('data.0.route_start_location_id', $startId);

        $this->assertDatabaseHas('locations', ['id' => $startId, 'name' => 'Hledan']);
    }

    public function test_admin_cannot_duplicate_trip_resource_assignments(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $start = Location::query()->create(['name' => 'Pearl Condo', 'latitude' => 16.8173200, 'longitude' => 96.1568310]);
        $end = Location::query()->create(['name' => 'Sule Square', 'latitude' => 16.7777246, 'longitude' => 96.1586703]);
        $busA = Bus::query()->create(['bus_code' => 'BUS-A', 'seat_count' => 24]);
        $busB = Bus::query()->create(['bus_code' => 'BUS-B', 'seat_count' => 24]);
        $driverA = $this->userWithRole('driver', ['email' => 'driver-a@example.com']);
        $driverB = $this->userWithRole('driver', ['email' => 'driver-b@example.com']);
        $date = now()->addDay()->toDateString();

        $payload = [
            'date_from' => $date,
            'date_to' => $date,
            'departure_time' => '18:00',
            'direction' => 'dropoff',
            'bus_id' => $busA->id,
            'driver_id' => $driverA->id,
            'route_start_location_id' => $start->id,
            'route_end_location_id' => $end->id,
        ];

        $this->postJson('/api/admin/trips', $payload)->assertCreated();
        $this->postJson('/api/admin/trips', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['bus_id']);

        $this->postJson('/api/admin/trips', [
            ...$payload,
            'bus_id' => $busB->id,
            'driver_id' => $driverB->id,
        ])->assertCreated();
    }

    public function test_admin_can_bulk_create_selected_trip_cycles(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $start = Location::query()->create(['name' => 'Pearl Condo', 'latitude' => 16.8173200, 'longitude' => 96.1568310]);
        $end = Location::query()->create(['name' => 'Sule Square', 'latitude' => 16.7777246, 'longitude' => 96.1586703]);
        $bus = Bus::query()->create(['bus_code' => 'BUS-SELECTED', 'seat_count' => 24]);
        $driver = $this->userWithRole('driver', ['email' => 'selected-driver@example.com']);
        $dateOne = now()->addDay()->toDateString();
        $dateThree = now()->addDays(3)->toDateString();
        $skippedDate = now()->addDays(2)->toDateString();

        $this->postJson('/api/admin/trips/bulk', [
            'cycles' => [
                [
                    'trip_date' => $dateOne,
                    'departure_time' => '18:00',
                    'direction' => 'dropoff',
                    'bus_id' => $bus->id,
                    'driver_id' => $driver->id,
                    'route_start_location_id' => $start->id,
                    'route_end_location_id' => $end->id,
                ],
                [
                    'trip_date' => $dateThree,
                    'departure_time' => '18:00',
                    'direction' => 'dropoff',
                    'bus_id' => $bus->id,
                    'driver_id' => $driver->id,
                    'route_start_location_id' => $start->id,
                    'route_end_location_id' => $end->id,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('count', 2);

        $this->assertDatabaseHas('trips', ['trip_date' => "{$dateOne} 00:00:00", 'bus_id' => $bus->id]);
        $this->assertDatabaseHas('trips', ['trip_date' => "{$dateThree} 00:00:00", 'bus_id' => $bus->id]);
        $this->assertDatabaseMissing('trips', ['trip_date' => "{$skippedDate} 00:00:00", 'bus_id' => $bus->id]);
    }

    public function test_passenger_booking_confirmation_respects_bus_capacity(): void
    {
        $passengerOne = $this->userWithRole('user', ['email' => 'one@example.com']);
        $passengerTwo = $this->userWithRole('user', ['email' => 'two@example.com']);
        $pickup = Location::query()->create(['name' => 'Pickup']);
        $dropoff = Location::query()->create(['name' => 'Office']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-01', 'seat_count' => 1]);
        $trip = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'confirmation_deadline' => now()->addHours(8),
            'bus_id' => $bus->id,
        ]);

        Sanctum::actingAs($passengerOne);
        $this->postJson('/api/bookings', [
            'trip_date' => $trip->trip_date->toDateString(),
            'departure_time' => $trip->departure_time,
            'direction' => $trip->direction,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
        ])->assertCreated();

        Sanctum::actingAs($passengerTwo);
        $this->postJson('/api/bookings', [
            'trip_date' => $trip->trip_date->toDateString(),
            'departure_time' => $trip->departure_time,
            'direction' => $trip->direction,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
        ])->assertUnprocessable();

        $this->assertSame(1, Booking::query()->where('status', 'confirmed')->count());
    }

    public function test_passenger_booking_single_bus_confirms_bus_immediately(): void
    {
        $passenger = $this->userWithRole('user', ['email' => 'solo-passenger@example.com']);
        $pickup = Location::query()->create(['name' => 'Pickup']);
        $dropoff = Location::query()->create(['name' => 'Office']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-SOLO', 'seat_count' => 12]);
        $trip = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'confirmation_deadline' => now()->addHours(8),
            'bus_id' => $bus->id,
        ]);

        Sanctum::actingAs($passenger);
        $this->getJson('/api/trips/upcoming')
            ->assertOk()
            ->assertJsonPath('data.0.assigned_bus_code', 'BUS-SOLO')
            ->assertJsonPath('data.0.requires_rebalance', false);

        $this->postJson('/api/bookings', [
            'trip_date' => $trip->trip_date->toDateString(),
            'departure_time' => $trip->departure_time,
            'direction' => $trip->direction,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
        ])
            ->assertCreated()
            ->assertJsonPath('message', 'Your seat is confirmed for '.$trip->trip_date->format('M j').' at 7:30 AM. Your bus is confirmed: BUS-SOLO.')
            ->assertJsonPath('data.trip.bus.bus_code', 'BUS-SOLO');
    }

    public function test_passenger_booking_multi_bus_waits_for_fleet_rebalancing(): void
    {
        $passenger = $this->userWithRole('user', ['email' => 'multi-passenger@example.com']);
        $pickup = Location::query()->create(['name' => 'Pickup']);
        $dropoff = Location::query()->create(['name' => 'Office']);
        $busA = Bus::query()->create(['bus_code' => 'BUS-A', 'seat_count' => 12]);
        $busB = Bus::query()->create(['bus_code' => 'BUS-B', 'seat_count' => 12]);
        $date = now()->addDay()->toDateString();
        $expectedCycleDate = Carbon::parse($date)->format('M j');

        Trip::query()->create(['trip_date' => $date, 'departure_time' => '07:30', 'direction' => 'pickup', 'bus_id' => $busA->id]);
        Trip::query()->create(['trip_date' => $date, 'departure_time' => '07:30', 'direction' => 'pickup', 'bus_id' => $busB->id]);

        Sanctum::actingAs($passenger);
        $this->getJson('/api/trips/upcoming')
            ->assertOk()
            ->assertJsonPath('data.0.assigned_bus_code', null)
            ->assertJsonPath('data.0.requires_rebalance', true);

        $this->postJson('/api/bookings', [
            'trip_date' => $date,
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
        ])
            ->assertCreated()
            ->assertJsonPath('message', "Your seat is confirmed for {$expectedCycleDate} at 7:30 AM. Your bus will be assigned after fleet rebalancing.");
    }

    public function test_driver_can_start_update_and_complete_assigned_trip(): void
    {
        $admin = $this->userWithRole('admin');
        $driver = $this->userWithRole('driver', ['email' => 'assigned-driver@example.com']);
        $passenger = $this->userWithRole('user', ['email' => 'passenger@example.com']);
        $pickup = Location::query()->create(['name' => 'Pickup']);
        $dropoff = Location::query()->create(['name' => 'Office']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-02', 'seat_count' => 12]);
        $trip = Trip::query()->create([
            'trip_date' => now(config('app.operations_timezone', 'Asia/Yangon'))->toDateString(),
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'confirmation_deadline' => now()->addHours(8),
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
        ]);
        $booking = Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passenger->id,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/bookings/{$booking->id}/confirm")->assertOk();

        Sanctum::actingAs($driver);
        $this->postJson("/api/driver/trips/{$trip->id}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'started');

        $this->postJson("/api/driver/trips/{$trip->id}/passengers/{$booking->id}/status", [
            'passenger_status' => 'dropped_off',
        ])
            ->assertOk()
            ->assertJsonPath('data.passenger_status.passenger_status', 'dropped_off');

        $this->postJson("/api/driver/trips/{$trip->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'completed']);
    }

    public function test_driver_cannot_start_future_cycle_trip(): void
    {
        $driver = $this->userWithRole('driver', ['email' => 'future-driver@example.com']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-03', 'seat_count' => 12]);
        $trip = Trip::query()->create([
            'trip_date' => now(config('app.operations_timezone', 'Asia/Yangon'))->addDay()->toDateString(),
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'confirmation_deadline' => now()->addHours(8),
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
        ]);

        Sanctum::actingAs($driver);
        $this->postJson("/api/driver/trips/{$trip->id}/start")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Trip can only be initialized on its cycle date.');

        $this->assertDatabaseHas('trips', ['id' => $trip->id, 'status' => 'scheduled']);
    }

    private function userWithRole(string $roleName, array $attributes = []): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();

        return User::factory()->create([
            'role_id' => $role->id,
            ...$attributes,
        ]);
    }
}
