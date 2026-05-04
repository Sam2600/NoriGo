# Software Design Document: Phase 2 Operations, Maps, Routing, And Fleet Rebalancing

## 1. Purpose

This document defines the Phase 2 rebuild specification for the Ferry Bus Management System. It is based on the current final implementation and extends Phase 1 with operational monitoring, Mapbox-based location management, driver route planning, passenger tracking, fleet rebalancing, and richer notifications.

## 2. Phase 2 Scope

### In Scope

- Admin operations dashboard.
- Live location update API for drivers.
- Passenger tracking page with Mapbox route and stop sequence.
- Driver optimized route planning using Mapbox Optimization API.
- Route start and route end anchors for trip planning.
- Admin location registration with Mapbox Search JS and Mapbox GL JS.
- Yangon/Myanmar bounded geocoding and reverse geocoding.
- Fleet rebalancing across multiple same-time buses.
- Uneven but geographically cleaner bus assignment groups.
- Single-bus bus-assignment notification without fleet rebalancing.
- Bus assignment notifications with passenger pickup-time guidance when a current route plan exists.
- Admin notification center with audience and trip targeting.
- Driver issue reporting and admin issue resolution.
- Emergency trip cancellation.
- Broadcast-event-ready backend with polling fallback in the frontend.
- Operations-focused UI polish.

### Out Of Scope

- Live turn-by-turn navigation.
- Continuous live rerouting.
- Driver mobile native app.
- Push notification provider integration.
- Redis/Reverb production setup by default.
- Petrol cost tracking.
- Feedback analytics.
- AI demand forecasting.

## 3. Rebuild Preparation For Phase 2

Prepare these external dependencies before rebuilding Phase 2:

- Mapbox public token for frontend maps and geocoding.
- Mapbox token available to Laravel for Optimization API calls.
- Supabase Postgres connection details if hosted data is needed.
- Render deployment settings if deploying the backend container.
- Decision on whether real WebSockets are required now or polling is acceptable.
- Test sample locations with latitude/longitude.
- At least one company/base location such as Pearl Condo for route start/end anchors.

Required environment values:

```txt
MAPBOX_ACCESS_TOKEN=
MAPBOX_OPTIMIZATION_PROFILE=mapbox/driving
VITE_MAPBOX_TOKEN=
VITE_MAPBOX_STYLE=mapbox://styles/mapbox/streets-v12
BROADCAST_CONNECTION=log
VITE_REVERB_APP_KEY=
```

## 4. Phase 2 Architecture

```txt
React operations UI
  -> TanStack Query polling
  -> Mapbox GL JS map surfaces
  -> Laravel API
  -> Route/fleet services
  -> Mapbox Optimization API
  -> PostgreSQL or SQLite tables
  -> Broadcast events, currently log-ready
```

Polling is the active local strategy. Laravel event classes are implemented so Reverb can be added later without rewriting the core operations flow.

## 5. Data Model Additions

### Trip Operational Fields

| Field | Purpose |
| --- | --- |
| operational_status | Operational state such as `scheduled`, `on_the_way`, `delayed`, `arrived_at_pickup`, `completed`, `cancelled`. |
| delay_minutes | Delay amount when delayed. |
| eta_at | Optional ETA timestamp. |
| status_note | Driver/admin note. |
| last_status_update_at | Last operational update time. |
| is_emergency_cancelled | Emergency cancellation flag. |
| cancel_reason | Cancellation explanation. |
| cancelled_by | Admin who cancelled. |
| cancelled_at | Cancellation time. |
| route_start_location_id | Fixed route start anchor. |
| route_end_location_id | Fixed route end anchor. |

### TripLocationUpdate

Stores driver location reports:

- trip_id
- driver_id
- latitude
- longitude
- heading
- speed_kmh
- accuracy_meters
- eta_at
- reported_at

### DriverIssueReport

Stores operational issues:

- trip_id
- driver_id
- issue_type
- severity
- title
- message
- status
- reported_at
- resolved_by
- resolved_at
- resolution_note

### TripRoutePlan

Stores optimized planned routes:

- trip_id
- provider
- profile
- status
- stops_hash
- input_stops
- ordered_stops
- route_geometry
- request_payload
- response_payload
- distance_meters
- duration_seconds
- error_message
- optimized_at

### Notification Additions

- created_by
- related_trip_id
- priority
- expires_at

## 6. Backend Services

### TripRouteService

Builds route stops from active bookings.

Pickup trips:

- Use route end or common drop-off as destination.
- Use route start when provided.
- Otherwise start from the farthest pickup from the destination.
- Middle stops are passenger pickup locations.

Dropoff trips:

- Use route start or common pickup as origin.
- Optimize passenger drop-off destinations.
- Use route end if provided, otherwise choose a farthest final destination.

The service also builds a stable `stops_hash` so stale route plans can be detected.

### MapboxRouteOptimizationService

- Calls Mapbox Optimized Trips API.
- Uses `roundtrip=false`, `source=first`, `destination=last`.
- Requests GeoJSON geometry.
- Saves ordered stops, sequence, estimated arrival offsets, distance, duration, request payload, and response payload.
- Saves failed optimization attempts with error details.
- Enforces Mapbox coordinate count limits.

### FleetAssignmentService

Handles multi-bus grouping and single-bus assignment notifications.

Multi-bus behavior:

- Requires at least two selected same-date, same-time, same-direction scheduled trips.
- Requires every selected trip to have a bus and valid capacity.
- Uses booking target coordinates: pickup coordinates for pickup trips and drop-off coordinates for dropoff trips.
- Groups passengers by coordinate clustering around route anchors.
- Allows uneven counts such as 3/7 or 4/6 when geography is cleaner.
- Applies assignment changes inside a database transaction.
- Deletes stale route plans for affected trips after reassignment.
- Notifies every assigned passenger, not only moved passengers.

Single-bus behavior:

- Does not require fleet rebalancing.
- Admin can send bus assignment notifications directly.
- Message includes the bus code and cycle date/time.
- If a current route plan exists, message includes the passenger pickup point and pickup time.
- If no route plan exists, the service tries to generate one through Mapbox.
- If route planning fails, message says pickup time will be shared after route planning.

### NotificationDispatchService

- Creates notification records.
- Filters inactive recipients.
- Deduplicates recipients.
- Dispatches `NotificationCreated` events.

## 7. API Contract

### Passenger Tracking

```txt
GET /api/tracking/active
GET /api/tracking/trips/{trip}
```

Tracking payload includes:

- booking
- trip
- latest_location
- location_history
- route_stops
- route_geometry
- open_issues

Passenger tracking strips booking IDs and passenger names from public route stops.

### Admin Operations

```txt
GET  /api/admin/operations
POST /api/admin/issues/{issue}/resolve
GET  /api/admin/notifications
POST /api/admin/notifications
POST /api/admin/trips/rebalance-assignments
POST /api/admin/trips/bus-assignments/notify
POST /api/admin/trips/{trip}/cancel
```

### Driver Operations

```txt
GET  /api/driver/trips
GET  /api/driver/trips/{trip}
GET  /api/driver/trips/{trip}/route-plan
POST /api/driver/trips/{trip}/route-plan/optimize
POST /api/driver/trips/{trip}/start
POST /api/driver/trips/{trip}/location
POST /api/driver/trips/{trip}/status
POST /api/driver/trips/{trip}/issues
POST /api/driver/trips/{trip}/passengers/{booking}/status
POST /api/driver/trips/{trip}/complete
```

### Notifications

```txt
GET  /api/notifications
POST /api/notifications/{notification}/read
POST /api/notifications/read-all
```

## 8. Frontend Phase 2 Screens

### Admin Operations

- Active trip monitoring.
- Latest bus location data.
- Open driver issue list.
- Issue resolution form.
- Emergency cancellation controls.

### Admin Locations

- Location form with validation.
- Mapbox Search JS React geocoder.
- Mapbox GL JS map picker.
- Yangon bounding box and Myanmar country filter.
- Reverse geocoding from manual map pin clicks.

### Admin Bookings

- Same-time compatible trip selection.
- Fleet Rebalancing panel.
- Preview grouping before applying.
- Apply grouping after confirmation modal.
- Single-bus cycle notice.
- Notify Bus Assignment button for single-bus cycles.

### Passenger Tracking

- Active confirmed booking tracking.
- Mapbox planned route line.
- Route stop sequence visible to passengers.
- Passenger pickup and destination highlighted.
- Public route payload excludes other passenger identities.
- Latest driver location if reported.

### Driver Trips

- Assigned trip selector.
- Cycle date lock for Initialize Trip.
- Complete Mission action.
- Optimized Logistics Plan card.
- Mapbox route plan map.
- Path sequence list.
- Incident reporting form.

## 9. Route Planning Rules

- Route plans are saved; they are not live turn-by-turn navigation.
- The driver or system calculates route plans before trip execution.
- A plan is stale if the current suggested stops hash does not match the saved `stops_hash`.
- Passenger tracking uses the saved optimized route if current.
- If no current optimized route exists, passenger tracking falls back to the same suggested stop sequence used by drivers, without geometry.
- Multiple stops at the same coordinates are merged visually into combined map markers.
- Pickup ETA in bus assignment notifications is calculated from `departure_time` plus the stop `estimated_arrival_offset_seconds`.

## 10. Fleet Rebalancing Rules

- Fleet rebalancing is only required when there is more than one scheduled trip for the same date/time/direction slot.
- The selected trips must have the same date, departure time, and direction.
- Selected trips must be scheduled.
- Each selected trip must have a bus with valid seat count.
- Total capacity must be greater than or equal to active bookings.
- Active bookings include `pending` and `confirmed`.
- Rebalancing may create uneven groups if the distance result is better.
- Rebalancing updates booking `trip_id` values and keeps passenger status records aligned.
- Rebalancing deletes affected route plans so drivers recalculate after assignment changes.
- All affected passengers receive bus assignment notifications.

## 11. Notification Rules

Important notification cases:

- Booking confirmed.
- Booking cancelled.
- Trip schedule changed.
- Bus assignment confirmed.
- Bus delayed.
- Bus on the way.
- Bus arrived at pickup.
- Trip completed.
- Driver issue reported.
- Emergency trip cancellation.

Bus assignment message examples:

```txt
Your bus is confirmed: BCM-BUS-0001 for May 5 at 6:45 AM. Please be at Hledan Center by 7:00 AM.
Your bus is confirmed: BCM-BUS-0001 for May 5 at 6:45 AM. Pickup time will be shared after route planning.
Your bus was reassigned to BCM-BUS-0002 for May 5 at 6:45 AM. Please be at Pearl Condo by 6:45 AM.
```

## 12. Real-Time Strategy

Implemented now:

- TanStack Query polling/refetch intervals.
- Backend event classes.
- `BROADCAST_CONNECTION=log` by default.
- Frontend Echo client available when Reverb variables are configured.

Future optional setup:

```txt
composer require laravel/reverb predis/predis
php artisan reverb:install
BROADCAST_CONNECTION=reverb
```

## 13. Deployment Notes

Backend Docker:

- `backend/Dockerfile`
- PHP 8.3 Apache image.
- Apache document root is `/var/www/html/public`.
- Render-compatible `PORT` support.
- Optional `RUN_MIGRATIONS=true` entrypoint behavior.
- Requires environment variables for database, app URL, frontend URL, Sanctum domains, CORS origins, and Mapbox token.

Frontend:

- Vite app can deploy separately.
- Configure `VITE_API_BASE_URL`.
- Configure `VITE_MAPBOX_TOKEN`.
- Keep frontend JavaScript-only.

Supabase:

- Use PostgreSQL connection values.
- Session Pooler is preferred for IPv4-only environments.
- Use `DB_SSLMODE=require`.

## 14. Testing And Verification

Backend:

```txt
php artisan test --filter=CoreWorkflowApiTest
php artisan test --filter=PhaseTwoOperationsApiTest
php artisan test
vendor/bin/pint --test
```

Frontend:

```txt
npm run lint
npm run test -- --run
npm run build
```

Important Phase 2 test coverage:

- Passenger tracking returns public full route sequence.
- Passenger tracking falls back when no route plan exists.
- Driver can generate optimized route plan.
- Admin can rebalance passengers across same-time trips.
- Rebalancing supports uneven passenger counts.
- Single-bus assignment notification works without rebalancing.
- Bus assignment notification includes pickup time when route plan exists.
- Driver cannot initialize future cycle trips.

## 15. Phase 2 Acceptance Criteria

- Admin can create accurate geocoded locations with Mapbox search or map pin.
- Admin can create trips with route start/end anchors.
- Driver can calculate a Mapbox optimized route plan.
- Driver can see route map, stop sequence, distance, and duration.
- Passenger can see the same planned route sequence without private passenger data.
- Fleet rebalancing only appears as an action for multi-bus slots.
- Multi-bus rebalancing can redistribute passengers into geographically cleaner groups.
- Single-bus slots can notify passengers directly without rebalancing.
- Bus assignment notifications include pickup time when route timing is available.
- Driver start is blocked before the trip cycle date.
- Admin operations dashboard can monitor active trips and resolve issues.
- Emergency trip cancellation notifies affected users.
- Frontend maps use Mapbox where map functionality is required.

## 16. Rebuild Order

When recreating Phase 2 from scratch, implement in this order:

1. Phase 1 schema, auth, roles, and base frontend shell.
2. Operational trip fields, notifications, location updates, and issue reports.
3. Mapbox frontend token setup and shared map component.
4. Admin location geocoder and map picker.
5. Route start/end trip anchors.
6. TripRouteService and MapboxRouteOptimizationService.
7. Driver route plan API and UI.
8. Passenger tracking payload and tracking UI.
9. FleetAssignmentService preview/apply.
10. Single-bus bus assignment notification.
11. Pickup-time enrichment for bus assignment messages.
12. Admin operations dashboard and emergency actions.
13. Tests, lint, build, and Docker deployment checks.
