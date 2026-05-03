<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DriverProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DriverController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => User::query()
                ->with(['role', 'driverProfile'])
                ->whereHas('role', fn ($query) => $query->where('name', 'driver'))
                ->orderBy('name')
                ->get()
                ->map(fn (User $driver) => $this->serializeDriver($driver)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'license_no' => ['nullable', 'string', 'max:255', Rule::unique('driver_profiles', 'license_no')],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ]);

        $driverRole = Role::query()->where('name', 'driver')->firstOrFail();

        $driver = User::query()->create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role_id' => $driverRole->id,
            'status' => $validated['status'] ?? 'active',
        ]);

        DriverProfile::query()->create([
            'user_id' => $driver->id,
            'license_no' => $validated['license_no'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'data' => $this->serializeDriver($driver->load(['role', 'driverProfile'])),
        ], 201);
    }

    public function show(User $driver): JsonResponse
    {
        $this->abortUnlessDriver($driver);

        return response()->json([
            'data' => $this->serializeDriver($driver->load(['role', 'driverProfile'])),
        ]);
    }

    public function update(Request $request, User $driver): JsonResponse
    {
        $this->abortUnlessDriver($driver);
        $licenseRule = Rule::unique('driver_profiles', 'license_no');

        if ($driver->driverProfile) {
            $licenseRule->ignore($driver->driverProfile->id);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($driver),
            ],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'license_no' => ['nullable', 'string', 'max:255', $licenseRule],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ]);

        $driver->fill(collect($validated)->only(['name', 'email', 'status'])->all());

        if (! empty($validated['password'])) {
            $driver->password = $validated['password'];
        }

        $driver->save();

        $driver->driverProfile()->updateOrCreate(
            ['user_id' => $driver->id],
            [
                'license_no' => $validated['license_no'] ?? $driver->driverProfile?->license_no,
                'status' => $validated['status'] ?? $driver->driverProfile?->status ?? 'active',
                'notes' => array_key_exists('notes', $validated) ? $validated['notes'] : $driver->driverProfile?->notes,
            ]
        );

        return response()->json([
            'data' => $this->serializeDriver($driver->refresh()->load(['role', 'driverProfile'])),
        ]);
    }

    public function destroy(User $driver): JsonResponse
    {
        $this->abortUnlessDriver($driver);

        $driver->update(['status' => 'inactive']);
        $driver->driverProfile?->update(['status' => 'inactive']);

        return response()->json([
            'message' => 'Driver deactivated successfully.',
            'data' => $this->serializeDriver($driver->refresh()->load(['role', 'driverProfile'])),
        ]);
    }

    private function abortUnlessDriver(User $driver): void
    {
        if ($driver->role?->name !== 'driver') {
            abort(404);
        }
    }

    private function serializeDriver(User $driver): array
    {
        return [
            'id' => $driver->id,
            'name' => $driver->name,
            'email' => $driver->email,
            'status' => $driver->status,
            'role' => $driver->role?->name,
            'driver_profile' => $driver->driverProfile,
        ];
    }
}
