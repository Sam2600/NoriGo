<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $profile = $request->user()
            ->profile()
            ->with(['defaultPickupLocation', 'defaultDropoffLocation'])
            ->first();

        return response()->json([
            'data' => $profile,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['nullable', 'string', 'max:50'],
            'default_pickup_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'default_dropoff_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $profile = UserProfile::query()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return response()->json([
            'data' => $profile->load(['defaultPickupLocation', 'defaultDropoffLocation']),
        ]);
    }
}
