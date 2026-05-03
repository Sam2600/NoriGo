<?php

namespace App\Http\Controllers\Api\Admin;

use App\Events\TripStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Trip;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TripController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Trip::query()
                ->with(['bus', 'driver.role', 'routeStartLocation', 'routeEndLocation'])
                ->with(['latestLocation'])
                ->withCount([
                    'bookings',
                    'bookings as confirmed_bookings_count' => fn ($query) => $query->where('status', 'confirmed'),
                    'bookings as pending_bookings_count' => fn ($query) => $query->where('status', 'pending'),
                    'issueReports as open_issues_count' => fn ($query) => $query->where('status', 'open'),
                ])
                ->orderByDesc('trip_date')
                ->orderBy('departure_time')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'departure_time' => ['required', 'date_format:H:i'],
            'direction' => ['required', Rule::in(['pickup', 'dropoff'])],
            'bus_id' => ['required', 'integer', Rule::exists('buses', 'id')->where('status', 'active')],
            'driver_id' => ['required', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'route_start_location_id' => ['required', 'integer', 'exists:locations,id'],
            'route_end_location_id' => ['required', 'integer', 'exists:locations,id', 'different:route_start_location_id'],
        ]);

        $this->validateDriverRole($validated['driver_id'] ?? null);

        $from = Carbon::parse($validated['date_from']);
        $to = Carbon::parse($validated['date_to']);

        if ($from->diffInDays($to) > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        $this->ensureNoScheduleConflicts($validated, $from, $to);

        $cycles = [];
        $date = $from->copy();

        while ($date->lte($to)) {
            $cycles[] = [
                'trip_date' => $date->toDateString(),
                'departure_time' => $validated['departure_time'],
                'direction' => $validated['direction'],
                'bus_id' => $validated['bus_id'],
                'driver_id' => $validated['driver_id'],
                'route_start_location_id' => $validated['route_start_location_id'],
                'route_end_location_id' => $validated['route_end_location_id'],
            ];
            $date->addDay();
        }

        $trips = $this->createCycles($cycles);

        return response()->json([
            'data' => $trips,
            'count' => $trips->count(),
        ], 201);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cycles' => ['required', 'array', 'min:1', 'max:90'],
            'cycles.*.trip_date' => ['required', 'date'],
            'cycles.*.departure_time' => ['required', 'date_format:H:i'],
            'cycles.*.direction' => ['required', Rule::in(['pickup', 'dropoff'])],
            'cycles.*.bus_id' => ['required', 'integer', Rule::exists('buses', 'id')->where('status', 'active')],
            'cycles.*.driver_id' => ['required', 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'cycles.*.route_start_location_id' => ['required', 'integer', 'exists:locations,id'],
            'cycles.*.route_end_location_id' => ['required', 'integer', 'exists:locations,id'],
        ]);

        $cycles = collect($validated['cycles'])
            ->map(fn (array $cycle): array => [
                ...$cycle,
                'trip_date' => Carbon::parse($cycle['trip_date'])->toDateString(),
            ])
            ->values()
            ->all();

        foreach ($cycles as $cycle) {
            $this->validateDriverRole($cycle['driver_id'] ?? null);
        }

        $this->ensureNoPayloadConflicts($cycles);

        foreach ($cycles as $cycle) {
            $date = Carbon::parse($cycle['trip_date']);
            $this->ensureNoScheduleConflicts($cycle, $date, $date);
        }

        $trips = $this->createCycles($cycles);

        return response()->json([
            'data' => $trips,
            'count' => $trips->count(),
        ], 201);
    }

    public function show(Trip $trip): JsonResponse
    {
        return response()->json([
            'data' => $trip->load([
                'bus',
                'driver.role',
                'routeStartLocation',
                'routeEndLocation',
                'latestLocation',
                'issueReports' => fn ($query) => $query->latest('reported_at')->limit(10),
                'bookings.user',
                'bookings.pickupLocation',
                'bookings.dropoffLocation',
                'bookings.passengerStatus',
            ]),
        ]);
    }

    public function update(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $validated = $this->validatedData($request, partial: true);
        $this->validateDriverRole($validated['driver_id'] ?? null);
        $this->ensureNoScheduleConflicts([
            ...$trip->only([
                'trip_date',
                'departure_time',
                'direction',
                'bus_id',
                'driver_id',
                'route_start_location_id',
                'route_end_location_id',
            ]),
            ...$validated,
        ], Carbon::parse($validated['trip_date'] ?? $trip->trip_date), Carbon::parse($validated['trip_date'] ?? $trip->trip_date), $trip);

        $scheduleBefore = $trip->only([
            'trip_date',
            'departure_time',
            'bus_id',
            'driver_id',
            'route_start_location_id',
            'route_end_location_id',
            'confirmation_deadline',
        ]);
        $statusBefore = $trip->only(['status', 'operational_status', 'delay_minutes', 'eta_at']);

        $trip->update($validated);
        $trip->refresh();

        if ($this->hasChanged($scheduleBefore, $trip, [
            'trip_date',
            'departure_time',
            'bus_id',
            'driver_id',
            'route_start_location_id',
            'route_end_location_id',
            'confirmation_deadline',
        ])) {
            $notifications->sendToTripPassengers($trip->loadMissing('driver'), [
                'created_by' => $request->user()->id,
                'title' => 'Trip schedule changed',
                'message' => 'A ferry bus trip you are assigned to has been updated. Please review the latest schedule.',
                'type' => 'schedule_change',
                'priority' => 'high',
            ]);
        }

        if ($this->hasChanged($statusBefore, $trip, ['status', 'operational_status', 'delay_minutes', 'eta_at'])) {
            event(new TripStatusUpdated($trip));
        }

        return response()->json([
            'data' => $trip->refresh()->load(['bus', 'driver.role', 'routeStartLocation', 'routeEndLocation']),
        ]);
    }

    public function destroy(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        return $this->cancel($request, $trip, $notifications);
    }

    public function cancel(Request $request, Trip $trip, NotificationDispatchService $notifications): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
            'is_emergency' => ['sometimes', 'boolean'],
        ]);

        $isEmergency = (bool) ($validated['is_emergency'] ?? false);

        $trip->update([
            'status' => 'cancelled',
            'operational_status' => 'cancelled',
            'is_emergency_cancelled' => $isEmergency,
            'cancel_reason' => $validated['reason'] ?? null,
            'cancelled_by' => $request->user()->id,
            'cancelled_at' => now(),
            'last_status_update_at' => now(),
        ]);

        $notifications->sendToTripPassengers($trip->refresh()->loadMissing('driver'), [
            'created_by' => $request->user()->id,
            'title' => $isEmergency ? 'Emergency trip cancellation' : 'Trip cancelled',
            'message' => $validated['reason'] ?? 'A ferry bus trip you are assigned to has been cancelled.',
            'type' => $isEmergency ? 'emergency' : 'cancellation',
            'priority' => $isEmergency ? 'urgent' : 'high',
        ]);
        $trip->bookings()
            ->whereIn('status', ['pending', 'confirmed'])
            ->update(['status' => 'cancelled']);
        event(new TripStatusUpdated($trip));

        return response()->json([
            'message' => 'Trip cancelled successfully.',
            'data' => $trip->refresh(),
        ]);
    }

    public function bookings(Trip $trip): JsonResponse
    {
        return response()->json([
            'data' => $trip->bookings()
                ->with(['user', 'pickupLocation', 'dropoffLocation', 'passengerStatus'])
                ->orderBy('created_at')
                ->get(),
        ]);
    }

    private function validatedData(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'trip_date' => [$required, 'date'],
            'departure_time' => [$required, 'date_format:H:i'],
            'direction' => [$required, Rule::in(['pickup', 'dropoff'])],
            'confirmation_deadline' => ['nullable', 'date'],
            'bus_id' => [$required, 'integer', Rule::exists('buses', 'id')->where('status', 'active')],
            'driver_id' => [$required, 'integer', Rule::exists('users', 'id')->where('status', 'active')],
            'route_start_location_id' => [$required, 'integer', 'exists:locations,id'],
            'route_end_location_id' => [$required, 'integer', 'exists:locations,id', 'different:route_start_location_id'],
            'status' => ['sometimes', Rule::in(['scheduled', 'started', 'completed', 'cancelled'])],
            'operational_status' => ['sometimes', Rule::in(['scheduled', 'on_the_way', 'delayed', 'arrived_at_pickup', 'completed', 'cancelled'])],
            'delay_minutes' => ['nullable', 'integer', 'min:0', 'max:720'],
            'eta_at' => ['nullable', 'date'],
            'status_note' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function validateDriverRole(?int $driverId): void
    {
        if (! $driverId) {
            return;
        }

        $isDriver = User::query()
            ->whereKey($driverId)
            ->whereHas('role', fn ($query) => $query->where('name', 'driver'))
            ->exists();

        abort_unless($isDriver, 422, 'The selected driver must have the driver role.');
    }

    private function ensureNoScheduleConflicts(array $data, Carbon $from, Carbon $to, ?Trip $currentTrip = null): void
    {
        $departureTime = Carbon::parse($data['departure_time'])->format('H:i:s');

        $baseQuery = Trip::query()
            ->whereDate('trip_date', '>=', $from->toDateString())
            ->whereDate('trip_date', '<=', $to->toDateString())
            ->where(function ($query) use ($departureTime): void {
                $query
                    ->whereTime('departure_time', $departureTime)
                    ->orWhere('departure_time', $departureTime)
                    ->orWhere('departure_time', substr($departureTime, 0, 5));
            })
            ->where('status', '!=', 'cancelled')
            ->when($currentTrip, fn ($query) => $query->whereKeyNot($currentTrip->id));

        $busConflict = (clone $baseQuery)
            ->where('bus_id', $data['bus_id'])
            ->orderBy('trip_date')
            ->first();

        if ($busConflict) {
            throw ValidationException::withMessages([
                'bus_id' => sprintf(
                    'Selected bus is already assigned on %s at %s.',
                    $busConflict->trip_date,
                    substr($departureTime, 0, 5),
                ),
            ]);
        }

        $driverConflict = (clone $baseQuery)
            ->where('driver_id', $data['driver_id'])
            ->orderBy('trip_date')
            ->first();

        if ($driverConflict) {
            throw ValidationException::withMessages([
                'driver_id' => sprintf(
                    'Selected driver is already assigned on %s at %s.',
                    $driverConflict->trip_date,
                    substr($departureTime, 0, 5),
                ),
            ]);
        }
    }

    private function ensureNoPayloadConflicts(array $cycles): void
    {
        $busSlots = [];
        $driverSlots = [];

        foreach ($cycles as $index => $cycle) {
            $departureTime = Carbon::parse($cycle['departure_time'])->format('H:i');
            $date = Carbon::parse($cycle['trip_date'])->toDateString();

            $busSlot = "{$date}|{$departureTime}|{$cycle['bus_id']}";
            $driverSlot = "{$date}|{$departureTime}|{$cycle['driver_id']}";

            if (isset($busSlots[$busSlot])) {
                throw ValidationException::withMessages([
                    "cycles.{$index}.bus_id" => 'This bus is selected more than once for the same date and time.',
                ]);
            }

            if (isset($driverSlots[$driverSlot])) {
                throw ValidationException::withMessages([
                    "cycles.{$index}.driver_id" => 'This driver is selected more than once for the same date and time.',
                ]);
            }

            $busSlots[$busSlot] = true;
            $driverSlots[$driverSlot] = true;
        }
    }

    private function createCycles(array $cycles)
    {
        $createdIds = DB::transaction(fn (): array => collect($cycles)
            ->map(fn (array $cycle): int => Trip::query()->create($cycle)->id)
            ->all());

        return Trip::query()
            ->with(['bus', 'driver.role', 'routeStartLocation', 'routeEndLocation'])
            ->whereIn('id', $createdIds)
            ->orderBy('trip_date')
            ->orderBy('departure_time')
            ->get();
    }

    private function hasChanged(array $before, Trip $trip, array $keys): bool
    {
        foreach ($keys as $key) {
            if (($before[$key] ?? null) != $trip->{$key}) {
                return true;
            }
        }

        return false;
    }
}
