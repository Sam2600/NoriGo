<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Bus;
use App\Models\DriverIssueReport;
use App\Models\Location;
use App\Models\Notification;
use App\Models\Role;
use App\Models\Trip;
use App\Models\TripPassengerStatus;
use App\Models\TripRoutePlan;
use App\Models\User;
use App\Services\TripRouteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PhaseTwoOperationsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_updates_location_status_and_reports_issue_for_live_operations(): void
    {
        $admin = $this->userWithRole('admin');
        $driver = $this->userWithRole('driver', ['email' => 'phase2-driver@example.com']);
        $passenger = $this->userWithRole('user', ['email' => 'phase2-passenger@example.com']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-P2', 'seat_count' => 12]);
        $pickup = Location::query()->create(['name' => 'Hledan', 'latitude' => 16.8219000, 'longitude' => 96.1301000]);
        $dropoff = Location::query()->create(['name' => 'Office', 'latitude' => 16.8502000, 'longitude' => 96.1856000]);
        $trip = Trip::query()->create([
            'trip_date' => now()->toDateString(),
            'departure_time' => '08:00',
            'direction' => 'pickup',
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

        Sanctum::actingAs($driver);

        $this->postJson("/api/driver/trips/{$trip->id}/location", [
            'latitude' => 16.8409,
            'longitude' => 96.1735,
            'speed_kmh' => 32,
            'eta_at' => now()->addMinutes(20)->toISOString(),
        ])
            ->assertCreated()
            ->assertJsonPath('data.trip_id', $trip->id);

        $this->postJson("/api/driver/trips/{$trip->id}/status", [
            'operational_status' => 'delayed',
            'delay_minutes' => 15,
            'status_note' => 'Traffic congestion.',
        ])
            ->assertOk()
            ->assertJsonPath('data.operational_status', 'delayed');

        $this->postJson("/api/driver/trips/{$trip->id}/issues", [
            'issue_type' => 'delay',
            'severity' => 'high',
            'title' => 'Heavy traffic',
            'message' => 'Traffic is heavy near the pickup route.',
        ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Heavy traffic');

        Sanctum::actingAs($passenger);
        $this->getJson('/api/tracking/active')
            ->assertOk()
            ->assertJsonPath('data.trip.operational_status', 'delayed')
            ->assertJsonPath('data.latest_location.trip_id', $trip->id)
            ->assertJsonCount(2, 'data.route_stops');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $passenger->id,
            'type' => 'delay',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type' => 'issue',
        ]);

        Sanctum::actingAs($admin);
        $issueId = DriverIssueReport::query()->firstOrFail()->id;
        $this->getJson('/api/admin/operations')
            ->assertOk()
            ->assertJsonPath('data.metrics.open_issues', 1);

        $this->postJson("/api/admin/issues/{$issueId}/resolve", [
            'resolution_note' => 'Driver contacted.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved');

        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'confirmed']);
    }

    public function test_passenger_tracking_returns_public_full_route_sequence(): void
    {
        $routes = app(TripRouteService::class);
        $driver = $this->userWithRole('driver', ['email' => 'privacy-driver@example.com']);
        $passenger = $this->userWithRole('user', ['email' => 'privacy-passenger@example.com']);
        $otherPassenger = $this->userWithRole('user', ['email' => 'other-passenger@example.com']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-PRIVATE', 'seat_count' => 12]);
        $routeStart = Location::query()->create(['name' => 'Route Start', 'latitude' => 16.8173200, 'longitude' => 96.1568310]);
        $routeEnd = Location::query()->create(['name' => 'Route End', 'latitude' => 16.9047863, 'longitude' => 96.1651130]);
        $pickup = Location::query()->create(['name' => 'Passenger Pickup', 'latitude' => 16.8219000, 'longitude' => 96.1301000]);
        $dropoff = Location::query()->create(['name' => 'Passenger Office', 'latitude' => 16.8502000, 'longitude' => 96.1856000]);
        $otherPickup = Location::query()->create(['name' => 'Other Pickup', 'latitude' => 16.8881634, 'longitude' => 96.1081784]);
        $otherDropoff = Location::query()->create(['name' => 'Other Office', 'latitude' => 16.7777246, 'longitude' => 96.1586703]);
        $trip = Trip::query()->create([
            'trip_date' => now()->toDateString(),
            'departure_time' => '08:00',
            'direction' => 'pickup',
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
            'route_start_location_id' => $routeStart->id,
            'route_end_location_id' => $routeEnd->id,
        ]);

        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passenger->id,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'status' => 'confirmed',
        ]);
        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $otherPassenger->id,
            'pickup_location_id' => $otherPickup->id,
            'dropoff_location_id' => $otherDropoff->id,
            'status' => 'confirmed',
        ]);
        $suggestedStops = $routes->optimizationStopsForTrip($trip);
        $orderedStops = $suggestedStops
            ->values()
            ->map(fn (array $stop, int $index): array => [
                ...$stop,
                'sequence' => $index + 1,
                'estimated_arrival_offset_seconds' => $index * 600,
            ]);
        TripRoutePlan::query()->create([
            'trip_id' => $trip->id,
            'stops_hash' => $routes->stopsHash($suggestedStops),
            'input_stops' => $suggestedStops->values()->all(),
            'ordered_stops' => $orderedStops->values()->all(),
            'route_geometry' => [
                'type' => 'LineString',
                'coordinates' => $orderedStops
                    ->map(fn (array $stop): array => [$stop['longitude'], $stop['latitude']])
                    ->values()
                    ->all(),
            ],
        ]);

        Sanctum::actingAs($passenger);
        $this->getJson('/api/tracking/active')
            ->assertOk()
            ->assertJsonCount(4, 'data.route_stops')
            ->assertJsonPath('data.route_stops.0.name', 'Route Start')
            ->assertJsonPath('data.route_stops.1.name', 'Passenger Pickup')
            ->assertJsonPath('data.route_stops.2.name', 'Other Pickup')
            ->assertJsonPath('data.route_geometry.type', 'LineString')
            ->assertJsonMissingPath('data.route_stops.1.passenger_name')
            ->assertJsonMissingPath('data.route_stops.1.passenger_names')
            ->assertJsonMissingPath('data.trip.route_plan')
            ->assertJsonMissingPath('data.trip.bookings');
    }

    public function test_passenger_tracking_falls_back_to_driver_suggested_sequence_without_route_plan(): void
    {
        $driver = $this->userWithRole('driver', ['email' => 'fallback-driver@example.com']);
        $passenger = $this->userWithRole('user', ['email' => 'fallback-passenger@example.com']);
        $otherPassenger = $this->userWithRole('user', ['email' => 'fallback-other@example.com']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-FALLBACK', 'seat_count' => 12]);
        $routeStart = Location::query()->create(['name' => 'Route Start', 'latitude' => 16.8173200, 'longitude' => 96.1568310]);
        $routeEnd = Location::query()->create(['name' => 'Route End', 'latitude' => 16.9047863, 'longitude' => 96.1651130]);
        $pickup = Location::query()->create(['name' => 'Passenger Pickup', 'latitude' => 16.8219000, 'longitude' => 96.1301000]);
        $dropoff = Location::query()->create(['name' => 'Passenger Office', 'latitude' => 16.8502000, 'longitude' => 96.1856000]);
        $otherPickup = Location::query()->create(['name' => 'Other Pickup', 'latitude' => 16.8881634, 'longitude' => 96.1081784]);
        $otherDropoff = Location::query()->create(['name' => 'Other Office', 'latitude' => 16.7777246, 'longitude' => 96.1586703]);
        $trip = Trip::query()->create([
            'trip_date' => now()->toDateString(),
            'departure_time' => '08:00',
            'direction' => 'pickup',
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
            'route_start_location_id' => $routeStart->id,
            'route_end_location_id' => $routeEnd->id,
        ]);

        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passenger->id,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'status' => 'confirmed',
        ]);
        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $otherPassenger->id,
            'pickup_location_id' => $otherPickup->id,
            'dropoff_location_id' => $otherDropoff->id,
            'status' => 'confirmed',
        ]);

        Sanctum::actingAs($passenger);
        $this->getJson('/api/tracking/active')
            ->assertOk()
            ->assertJsonCount(4, 'data.route_stops')
            ->assertJsonPath('data.route_stops.0.name', 'Route Start')
            ->assertJsonPath('data.route_stops.1.name', 'Passenger Pickup')
            ->assertJsonPath('data.route_stops.2.name', 'Other Pickup')
            ->assertJsonPath('data.route_stops.3.name', 'Route End')
            ->assertJsonPath('data.route_geometry', null)
            ->assertJsonMissingPath('data.route_stops.1.passenger_name')
            ->assertJsonMissingPath('data.trip.bookings');
    }

    public function test_admin_can_manage_notifications_and_emergency_cancellations(): void
    {
        $admin = $this->userWithRole('admin');
        $driver = $this->userWithRole('driver', ['email' => 'notify-driver@example.com']);
        $passenger = $this->userWithRole('user', ['email' => 'notify-passenger@example.com']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-NOTIFY', 'seat_count' => 12]);
        $trip = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '07:30',
            'direction' => 'pickup',
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
        ]);
        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passenger->id,
            'status' => 'confirmed',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/notifications', [
            'audience' => 'trip',
            'trip_id' => $trip->id,
            'title' => 'Schedule reminder',
            'message' => 'Please check the updated pickup schedule.',
            'type' => 'schedule_change',
            'priority' => 'high',
        ])
            ->assertCreated()
            ->assertJsonPath('meta.created_count', 2);

        $this->postJson("/api/admin/trips/{$trip->id}/cancel", [
            'is_emergency' => true,
            'reason' => 'Road closure near pickup point.',
        ])->assertOk();

        $this->assertDatabaseHas('trips', [
            'id' => $trip->id,
            'status' => 'cancelled',
            'operational_status' => 'cancelled',
            'is_emergency_cancelled' => true,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $passenger->id,
            'type' => 'emergency',
        ]);

        Sanctum::actingAs($passenger);
        $this->postJson('/api/notifications/read-all')->assertOk();
        $this->assertSame(0, Notification::query()
            ->where('user_id', $passenger->id)
            ->whereNull('read_at')
            ->count());
    }

    public function test_driver_can_generate_optimized_route_plan_for_trip_destinations(): void
    {
        Config::set('services.mapbox.access_token', 'test-mapbox-token');

        Http::fake([
            'api.mapbox.com/optimized-trips/v1/*' => Http::response([
                'code' => 'Ok',
                'waypoints' => [
                    ['name' => 'Office Road', 'location' => [96.1700000, 16.8400000], 'waypoint_index' => 0],
                    ['name' => 'Home A', 'location' => [96.1900000, 16.8600000], 'waypoint_index' => 1],
                    ['name' => 'Home B', 'location' => [96.2100000, 16.8800000], 'waypoint_index' => 2],
                ],
                'trips' => [[
                    'geometry' => [
                        'type' => 'LineString',
                        'coordinates' => [
                            [96.1700000, 16.8400000],
                            [96.1900000, 16.8600000],
                            [96.2100000, 16.8800000],
                        ],
                    ],
                    'distance' => 8200.4,
                    'duration' => 1380.2,
                ]],
            ]),
        ]);

        $driver = $this->userWithRole('driver', ['email' => 'route-driver@example.com']);
        $passengerOne = $this->userWithRole('user', ['email' => 'route-one@example.com']);
        $passengerTwo = $this->userWithRole('user', ['email' => 'route-two@example.com']);
        $bus = Bus::query()->create(['bus_code' => 'BUS-ROUTE', 'seat_count' => 20]);
        $office = Location::query()->create(['name' => 'Office', 'latitude' => 16.8400000, 'longitude' => 96.1700000]);
        $homeOne = Location::query()->create(['name' => 'Home A', 'latitude' => 16.8600000, 'longitude' => 96.1900000]);
        $homeTwo = Location::query()->create(['name' => 'Home B', 'latitude' => 16.8800000, 'longitude' => 96.2100000]);
        $trip = Trip::query()->create([
            'trip_date' => now()->toDateString(),
            'departure_time' => '18:00',
            'direction' => 'dropoff',
            'bus_id' => $bus->id,
            'driver_id' => $driver->id,
            'route_start_location_id' => $office->id,
        ]);

        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passengerOne->id,
            'pickup_location_id' => $office->id,
            'dropoff_location_id' => $homeOne->id,
            'status' => 'confirmed',
        ]);
        Booking::query()->create([
            'trip_id' => $trip->id,
            'user_id' => $passengerTwo->id,
            'pickup_location_id' => $office->id,
            'dropoff_location_id' => $homeTwo->id,
            'status' => 'confirmed',
        ]);

        Sanctum::actingAs($driver);

        $this->postJson("/api/driver/trips/{$trip->id}/route-plan/optimize")
            ->assertOk()
            ->assertJsonPath('data.status', 'optimized')
            ->assertJsonPath('data.distance_meters', 8200)
            ->assertJsonCount(3, 'data.ordered_stops')
            ->assertJsonPath('data.ordered_stops.0.type', 'origin')
            ->assertJsonPath('data.ordered_stops.1.name', 'Home A')
            ->assertJsonPath('data.ordered_stops.2.name', 'Home B');

        $this->assertDatabaseHas('trip_route_plans', [
            'trip_id' => $trip->id,
            'provider' => 'mapbox',
            'status' => 'optimized',
            'distance_meters' => 8200,
        ]);
    }

    public function test_admin_can_rebalance_passengers_across_same_window_dropoff_trips(): void
    {
        $admin = $this->userWithRole('admin');
        $passengerOne = $this->userWithRole('user', ['email' => 'fleet-one@example.com']);
        $passengerTwo = $this->userWithRole('user', ['email' => 'fleet-two@example.com']);
        $passengerThree = $this->userWithRole('user', ['email' => 'fleet-three@example.com']);
        $passengerFour = $this->userWithRole('user', ['email' => 'fleet-four@example.com']);
        $office = Location::query()->create(['name' => 'Pearl Condo', 'latitude' => 16.8173200, 'longitude' => 96.1568310]);
        $sule = Location::query()->create(['name' => 'Sule Square', 'latitude' => 16.7777247, 'longitude' => 96.1586704]);
        $bahan = Location::query()->create(['name' => 'Bahan 3rd street', 'latitude' => 16.7982426, 'longitude' => 96.1555901]);
        $thunandar = Location::query()->create(['name' => 'Thunandar Junction', 'latitude' => 16.9047863, 'longitude' => 96.1651131]);
        $okkala = Location::query()->create(['name' => 'South Okkalapa Pagoda', 'latitude' => 16.8529472, 'longitude' => 96.1859022]);
        $busA = Bus::query()->create(['bus_code' => 'BUS-A', 'seat_count' => 2]);
        $busB = Bus::query()->create(['bus_code' => 'BUS-B', 'seat_count' => 2]);
        $tripA = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '18:00',
            'direction' => 'dropoff',
            'bus_id' => $busA->id,
            'route_start_location_id' => $office->id,
        ]);
        $tripB = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '18:00',
            'direction' => 'dropoff',
            'bus_id' => $busB->id,
            'route_start_location_id' => $office->id,
        ]);

        $bookingSule = Booking::query()->create([
            'trip_id' => $tripA->id,
            'user_id' => $passengerOne->id,
            'pickup_location_id' => $office->id,
            'dropoff_location_id' => $sule->id,
            'status' => 'confirmed',
        ]);
        $bookingOkkala = Booking::query()->create([
            'trip_id' => $tripA->id,
            'user_id' => $passengerTwo->id,
            'pickup_location_id' => $office->id,
            'dropoff_location_id' => $okkala->id,
            'status' => 'confirmed',
        ]);
        $bookingBahan = Booking::query()->create([
            'trip_id' => $tripB->id,
            'user_id' => $passengerThree->id,
            'pickup_location_id' => $office->id,
            'dropoff_location_id' => $bahan->id,
            'status' => 'confirmed',
        ]);
        $bookingThunandar = Booking::query()->create([
            'trip_id' => $tripB->id,
            'user_id' => $passengerFour->id,
            'pickup_location_id' => $office->id,
            'dropoff_location_id' => $thunandar->id,
            'status' => 'confirmed',
        ]);

        collect([$bookingSule, $bookingOkkala, $bookingBahan, $bookingThunandar])
            ->each(fn (Booking $booking): TripPassengerStatus => TripPassengerStatus::query()->create([
                'trip_id' => $booking->trip_id,
                'booking_id' => $booking->id,
                'passenger_status' => 'waiting',
            ]));

        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/trips/rebalance-assignments', [
            'trip_ids' => [$tripA->id, $tripB->id],
            'apply' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.applied', false)
            ->assertJsonPath('data.total_bookings', 4)
            ->assertJsonCount(2, 'data.groups');

        $this->postJson('/api/admin/trips/rebalance-assignments', [
            'trip_ids' => [$tripA->id, $tripB->id],
            'apply' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.applied', true);

        $southTripIds = Booking::query()
            ->whereIn('dropoff_location_id', [$sule->id, $bahan->id])
            ->pluck('trip_id')
            ->unique()
            ->values();
        $northTripIds = Booking::query()
            ->whereIn('dropoff_location_id', [$okkala->id, $thunandar->id])
            ->pluck('trip_id')
            ->unique()
            ->values();

        $this->assertCount(1, $southTripIds);
        $this->assertCount(1, $northTripIds);
        $this->assertNotSame($southTripIds->first(), $northTripIds->first());

        Booking::query()
            ->with('passengerStatus')
            ->whereIn('id', [$bookingSule->id, $bookingOkkala->id, $bookingBahan->id, $bookingThunandar->id])
            ->get()
            ->each(fn (Booking $booking) => $this->assertSame($booking->trip_id, $booking->passengerStatus?->trip_id));

        $this->assertDatabaseHas('notifications', [
            'type' => 'schedule_change',
            'title' => 'Bus assignment confirmed',
        ]);
    }

    public function test_fleet_rebalancing_allows_uneven_bus_counts_when_locations_cluster_that_way(): void
    {
        $admin = $this->userWithRole('admin');
        $office = Location::query()->create(['name' => 'Pearl Condo', 'latitude' => 16.8173200, 'longitude' => 96.1568310]);
        $busA = Bus::query()->create(['bus_code' => 'BUS-A', 'seat_count' => 10]);
        $busB = Bus::query()->create(['bus_code' => 'BUS-B', 'seat_count' => 10]);
        $tripA = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '18:00',
            'direction' => 'dropoff',
            'bus_id' => $busA->id,
            'route_start_location_id' => $office->id,
        ]);
        $tripB = Trip::query()->create([
            'trip_date' => now()->addDay()->toDateString(),
            'departure_time' => '18:00',
            'direction' => 'dropoff',
            'bus_id' => $busB->id,
            'route_start_location_id' => $office->id,
        ]);

        $dropoffs = collect([
            ['Sule Square', 16.7777247, 96.1586704],
            ['Bahan 3rd street', 16.7982426, 96.1555901],
            ['Hledan Center', 16.8263627, 96.1303788],
            ['South Okkalapa Pagoda', 16.8529472, 96.1859022],
            ['Kabar Aye Gamone Pwint', 16.8562590, 96.1572586],
            ['8 mile Junction', 16.8664114, 96.1424977],
            ['Insein Park', 16.8881634, 96.1081785],
            ['7/8 Junction', 16.8914821, 96.1968142],
            ['Thunandar Junction', 16.9047863, 96.1651131],
            ['North Okkalapa Market', 16.9130000, 96.1700000],
        ])->map(fn (array $location): Location => Location::query()->create([
            'name' => $location[0],
            'latitude' => $location[1],
            'longitude' => $location[2],
        ]));

        $dropoffs->each(function (Location $dropoff, int $index) use ($office, $tripA, $tripB): void {
            $passenger = $this->userWithRole('user', [
                'email' => sprintf('uneven-passenger-%02d@example.com', $index + 1),
            ]);

            Booking::query()->create([
                'trip_id' => $index % 2 === 0 ? $tripA->id : $tripB->id,
                'user_id' => $passenger->id,
                'pickup_location_id' => $office->id,
                'dropoff_location_id' => $dropoff->id,
                'status' => 'confirmed',
            ]);
        });

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/trips/rebalance-assignments', [
            'trip_ids' => [$tripA->id, $tripB->id],
            'apply' => false,
        ])->assertOk();

        $counts = collect($response->json('data.groups'))
            ->pluck('booking_count')
            ->sort()
            ->values()
            ->all();

        $this->assertSame([3, 7], $counts);
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
