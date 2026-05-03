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

    public function run(): void
    {
        $roles = collect([
            ['name' => 'admin', 'display_name' => 'Admin'],
            ['name' => 'driver', 'display_name' => 'Driver'],
            ['name' => 'user', 'display_name' => 'User'],
        ])->mapWithKeys(function (array $role): array {
            $model = Role::query()->updateOrCreate(
                ['name' => $role['name']],
                ['display_name' => $role['display_name']]
            );

            return [$role['name'] => $model];
        });

        User::query()->updateOrCreate([
            'email' => env('DEFAULT_ADMIN_EMAIL', 'admin@ferrybus.local'),
        ], [
            'name' => env('DEFAULT_ADMIN_NAME', 'System Admin'),
            'password' => env('DEFAULT_ADMIN_PASSWORD', 'password'),
            'role_id' => $roles->get('admin')->id,
            'status' => 'active',
        ]);

        $sampleLocations = collect([
            ['name' => 'Pearl Condo', 'address' => 'Pearl Condo', 'latitude' => 16.8173200, 'longitude' => 96.1568310],
            ['name' => 'Thunandar Junction', 'address' => 'Thunandar Junction', 'latitude' => 16.9047863, 'longitude' => 96.1651131],
            ['name' => 'South Okkalapa Pagoda', 'address' => 'South Okkalapa Pagoda', 'latitude' => 16.8529472, 'longitude' => 96.1859022],
            ['name' => 'Bahan 3rd street', 'address' => 'Bahan 3rd street', 'latitude' => 16.7982426, 'longitude' => 96.1555901],
            ['name' => '7/8 Junction', 'address' => '7/8 Junction', 'latitude' => 16.8914821, 'longitude' => 96.1968142],
            ['name' => 'Kabar Aye Gamone Pwint', 'address' => 'Kabar Aye Gamone Pwint', 'latitude' => 16.8562590, 'longitude' => 96.1572586],
            ['name' => 'Insein Park', 'address' => 'Insein Park', 'latitude' => 16.8881634, 'longitude' => 96.1081785],
            ['name' => 'Hledan Center', 'address' => 'Hledan Center', 'latitude' => 16.8263627, 'longitude' => 96.1303788],
            ['name' => '8 mile Junction', 'address' => '8 mile Junction', 'latitude' => 16.8664114, 'longitude' => 96.1424977],
            ['name' => 'Sule Square', 'address' => 'Sule Square', 'latitude' => 16.7777247, 'longitude' => 96.1586704],
        ]);

        $sampleLocations->each(fn (array $location) => Location::query()->updateOrCreate(
            ['name' => $location['name']],
            [
                'address' => $location['address'],
                'latitude' => $location['latitude'],
                'longitude' => $location['longitude'],
            ]
        ));

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
                    'default_dropoff_location_id' => $locationIds->get($dropoffLocation['name']),
                    'notes' => 'Seed sample passenger for booking tests.',
                ]
            );
        });
    }
}
