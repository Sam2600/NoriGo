<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Role;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $roles = collect([
            ['name' => 'admin', 'display_name' => 'Admin'],
            ['name' => 'driver', 'display_name' => 'Driver'],
            ['name' => 'user', 'display_name' => 'User'],
        ])->mapWithKeys(function (array $role): array {
            $model = Role::query()->firstOrCreate(
                ['name' => $role['name']],
                ['display_name' => $role['display_name']]
            );

            return [$role['name'] => $model];
        });

        User::query()->firstOrCreate([
            'email' => env('DEFAULT_ADMIN_EMAIL', 'admin@ferrybus.local'),
        ], [
            'name' => env('DEFAULT_ADMIN_NAME', 'System Admin'),
            'password' => env('DEFAULT_ADMIN_PASSWORD', 'password'),
            'role_id' => $roles->get('admin')->id,
            'status' => 'active',
        ]);

        $sampleLocations = collect([
            [
                'name' => 'Pearl Condo',
                'address' => 'Pearl Condo',
                'latitude' => 16.81732000494492,
                'longitude' => 96.15683106931587,
            ],
            [
                'name' => 'Thunandar Junction',
                'address' => 'Thunandar Junction',
                'latitude' => 16.90478633327054,
                'longitude' => 96.16511307611266,
            ],
            [
                'name' => 'South Okkalapa Pagoda',
                'address' => 'South Okkalapa Pagoda',
                'latitude' => 16.85294721179099,
                'longitude' => 96.1859021977745,
            ],
            [
                'name' => 'Bahan 3rd street',
                'address' => 'Bahan 3rd street',
                'latitude' => 16.79824263346192,
                'longitude' => 96.15559010956026,
            ],
            [
                'name' => '7/8 Junction',
                'address' => '7/8 Junction',
                'latitude' => 16.89148208887756,
                'longitude' => 96.1968142374461,
            ],
            [
                'name' => 'Kabar Aye Gamone Pwint',
                'address' => 'Kabar Aye Gamone Pwint',
                'latitude' => 16.85625901970342,
                'longitude' => 96.15725856723283,
            ],
            [
                'name' => 'Insein Park',
                'address' => 'Insein Park',
                'latitude' => 16.888163442239062,
                'longitude' => 96.10817848072706,
            ],
            [
                'name' => 'Hledan Center',
                'address' => 'Hledan Center',
                'latitude' => 16.826362713023148,
                'longitude' => 96.13037879606757,
            ],
            [
                'name' => '8 mile Junction',
                'address' => '8 mile Junction',
                'latitude' => 16.866411432511445,
                'longitude' => 96.14249770771346,
            ],
            [
                'name' => 'Sule Square',
                'address' => 'Sule Square',
                'latitude' => 16.77772466819498,
                'longitude' => 96.15867039342046,
            ],
        ]);

        $sampleLocations->each(function (array $location): void {
            Location::query()->updateOrCreate(
                ['name' => $location['name']],
                [
                    'address' => $location['address'],
                    'latitude' => $location['latitude'],
                    'longitude' => $location['longitude'],
                ]
            );
        });

        $locationIds = Location::query()
            ->whereIn('name', $sampleLocations->pluck('name')->all())
            ->pluck('id', 'name');

        $sampleLocations->values()->each(function (array $pickupLocation, int $index) use ($locationIds, $roles, $sampleLocations): void {
            $passengerNumber = $index + 1;
            $dropoffLocation = $sampleLocations->values()->get($passengerNumber % $sampleLocations->count());

            $user = User::query()->updateOrCreate(
                ['email' => sprintf('passenger%02d@ferrybus.local', $passengerNumber)],
                [
                    'name' => sprintf('Sample Passenger %02d', $passengerNumber),
                    'password' => 'password',
                    'role_id' => $roles->get('user')->id,
                    'status' => 'active',
                ]
            );

            UserProfile::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'phone' => sprintf('09100000%02d', $passengerNumber),
                    'default_pickup_location_id' => $locationIds->get($pickupLocation['name']),
                    'default_dropoff_location_id' => $locationIds->get($pickupLocation['name']),
                    'notes' => 'Seed sample passenger for booking and route planning tests.',
                ]
            );
        });
    }
}
