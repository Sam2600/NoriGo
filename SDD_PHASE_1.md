# Software Design Document: Phase 1 Core Platform

## 1. Purpose

This document defines the Phase 1 rebuild specification for the Ferry Bus Management System. It is based on the current implemented codebase and should be treated as the source of truth when recreating the application from scratch.

Phase 1 covers the foundation: authentication, role separation, profile and location data, fleet data, trip scheduling, passenger booking, driver assignment, bus capacity protection, notifications, and the core frontend shell.

## 2. Rebuild Preparation

Before recreating the app from scratch, prepare these items:

- Freeze the current repository or create a backup branch before deleting or regenerating code.
- Keep copies of `README.md`, `FEATURE_PLAN.md`, `tech-stack.txt`, `SDD_PHASE_1.md`, `SDD_PHASE_2.md`, and `DRIVER_ROUTE_PLANNING_GUIDE.md`.
- Export or snapshot any production Supabase data before running destructive database commands.
- Save all environment values outside the repo, especially database credentials, Sanctum/CORS origins, admin seed credentials, and Mapbox tokens.
- Decide whether the rebuild will target local SQLite first or Supabase Postgres from day one.
- Keep the frontend JavaScript-only. Do not introduce TypeScript.
- Rebuild in this order: backend schema, auth/RBAC, admin CRUD, passenger booking, driver workflow, notifications, frontend shell, then Phase 2 operations.

## 3. Product Summary

The system manages daily company ferry bus operations for three roles:

- Admins create operational data, schedule trips, monitor demand, rebalance buses, and send notifications.
- Passengers book ferry seats, receive bus assignment notifications, manage profile defaults, and view their travel status.
- Drivers view assigned trips, calculate route plans, initialize trips, report issues, and complete missions.

## 4. Phase 1 Scope

### In Scope

- Laravel API backend with Sanctum token authentication.
- React JavaScript frontend with Vite.
- Separate `roles` table with `admin`, `driver`, and `user` roles.
- Role middleware for protected API route groups.
- User registration and login.
- Profile management with phone, notes, default pickup, and default drop-off locations.
- Admin location, bus, driver, and trip management.
- Trip range creation and bulk cycle creation through editable drafts.
- Duplicate schedule validation for buses and drivers.
- Passenger booking by trip date, departure time, and direction.
- Seat capacity validation across one or more same-time trips.
- Single-bus cycles confirm the bus immediately.
- Multi-bus cycles defer final bus assignment until fleet rebalancing.
- Admin booking review, confirmation, and cancellation.
- Driver assigned trip list, trip start, passenger status API, and trip completion.
- In-app notifications with read and read-all flows.
- Seeded roles and default admin; optional Yangon sample locations and sample passengers are controlled by `SEED_SAMPLE_DATA`.
- Dockerized Laravel backend for Render-compatible web service deployment.

### Out Of Scope For Phase 1

- Live turn-by-turn navigation.
- Real-time route rerouting.
- Payment processing.
- Petrol/fuel cost tracking.
- Feedback analytics.
- AI demand forecasting.
- Chat between passengers, admins, and drivers.

## 5. Architecture

```txt
React SPA
  -> Axios API client
  -> Laravel Sanctum API
  -> Laravel services and models
  -> SQLite for local development or Supabase Postgres for hosted data
```

### Backend

- Framework: Laravel 12.
- Language: PHP 8.2+.
- Auth: Laravel Sanctum bearer tokens.
- Database: SQLite locally, PostgreSQL/Supabase for hosted environments.
- Testing: PHPUnit feature tests.
- Formatting: Laravel Pint.
- Deployment: `backend/Dockerfile` with PHP 8.3 Apache, configurable `PORT`, optional `RUN_MIGRATIONS=true`.

### Frontend

- Framework: React 19 with JavaScript only.
- Build tool: Vite.
- Routing: React Router.
- Data fetching: TanStack Query.
- Forms: React Hook Form and Zod.
- Styling: Tailwind CSS.
- Icons: Heroicons.
- HTTP: Axios.
- Tests: Vitest and React Testing Library.

## 6. Roles And Permissions

| Role | Main Permissions |
| --- | --- |
| Admin | Dashboard, locations, buses, drivers, trips, bookings, fleet assignment, notifications, operations, cancellations. |
| Driver | Assigned trips, route plan view/calculation, trip initialize, location update API, issue reports, passenger status API, trip completion. |
| User | Profile, available cycles, bookings, cancellations, tracking, notifications. |

The frontend redirects by role:

- Admin: `/`
- Driver: `/driver-trips`
- User: `/bookings`

## 7. Core Workflows

### 7.1 Authentication

1. Visitor registers or logs in.
2. Backend validates credentials and returns a Sanctum token plus user role data.
3. Frontend stores the token and user in local storage.
4. Axios sends the token on later API calls.
5. Role-based routes restrict admin and driver APIs.

### 7.2 Admin Setup Workflow

1. Admin creates locations with address, latitude, and longitude.
2. Admin creates active buses with seat counts.
3. Admin creates active drivers.
4. Admin creates trip cycles with date, time, direction, bus, driver, route start, and route end.
5. For date ranges, the frontend first generates editable draft rows.
6. Admin selects only the draft rows to register.
7. Backend rejects duplicate bus or driver assignments for the same date/time slot.

### 7.3 Passenger Booking Workflow

1. Passenger opens available cycles.
2. System groups same-time trips by date, departure time, and direction.
3. Passenger joins a cycle, not a raw trip ID.
4. Backend chooses the scheduled trip in that slot with available capacity and the fewest confirmed bookings.
5. Booking is created as `confirmed`.
6. `TripPassengerStatus` is created with `waiting`.
7. If the slot has one bus, the confirmation message includes that bus code.
8. If the slot has multiple buses, the confirmation message says the bus will be assigned after fleet rebalancing.

### 7.4 Admin Booking Workflow

1. Admin selects a trip cycle.
2. Admin reviews passengers, pickup/drop-off locations, status, and transit status.
3. Admin can cancel passenger bookings.
4. Admin can confirm pending bookings where this status exists from older/manual flows.
5. Seat capacity is enforced before confirmation.

### 7.5 Driver Mission Workflow

1. Driver logs in and lands on `/driver-trips`.
2. Driver selects an assigned scheduled or started trip.
3. Driver can initialize the trip only on the cycle date.
4. Driver can complete a started trip.
5. Completion marks confirmed bookings as completed.
6. Backend APIs still support passenger status updates for `waiting`, `picked_up`, `absent`, and `dropped_off`.

## 8. Data Model

### Role

| Field | Notes |
| --- | --- |
| id | Primary key. |
| name | Unique role key: `admin`, `driver`, `user`. |
| display_name | Human label. |

### User

| Field | Notes |
| --- | --- |
| id | Primary key. |
| name | Display name. |
| email | Unique login email. |
| password | Hashed password. |
| role_id | Foreign key to roles. |
| status | `active` or inactive-style status. |

### UserProfile

| Field | Notes |
| --- | --- |
| user_id | Passenger user. |
| phone | Contact number. |
| default_pickup_location_id | Default pickup location. |
| default_dropoff_location_id | Default drop-off location. |
| notes | Free-form notes. |

### Location

| Field | Notes |
| --- | --- |
| name | Location name. |
| address | Human-readable address. |
| latitude | Decimal coordinate. |
| longitude | Decimal coordinate. |

### Bus

| Field | Notes |
| --- | --- |
| bus_code | Unique operational code. |
| seat_count | Capacity. |
| status | Active, inactive, or maintenance. |
| notes | Optional admin notes. |

### DriverProfile

| Field | Notes |
| --- | --- |
| user_id | User with driver role. |
| license_no | Unique driver license number. |
| status | Driver profile status. |

### Trip

| Field | Notes |
| --- | --- |
| trip_date | Service date. |
| departure_time | Planned departure. |
| direction | `pickup` or `dropoff`. |
| confirmation_deadline | Optional booking cutoff. |
| bus_id | Assigned bus, required in current admin trip creation. |
| driver_id | Assigned driver, required in current admin trip creation. |
| route_start_location_id | Route anchor/start point. |
| route_end_location_id | Route anchor/end point. |
| status | `scheduled`, `started`, `completed`, `cancelled`. |
| started_at | Actual start timestamp. |
| completed_at | Actual completion timestamp. |

### Booking

| Field | Notes |
| --- | --- |
| trip_id | Assigned trip after capacity selection/rebalancing. |
| user_id | Passenger. |
| pickup_location_id | Booking pickup point. |
| dropoff_location_id | Booking destination. |
| status | `pending`, `confirmed`, `cancelled`, `completed`, `missed`. |
| cancelled_by | User/admin who cancelled. |
| cancelled_at | Cancellation time. |
| trip_reminder_sent_at | Reminder timestamp for operations. |

### TripPassengerStatus

| Field | Notes |
| --- | --- |
| trip_id | Related trip. |
| booking_id | Related booking. |
| passenger_status | `waiting`, `picked_up`, `absent`, `dropped_off`. |
| updated_by | Driver/admin user ID. |

### Notification

| Field | Notes |
| --- | --- |
| user_id | Recipient. |
| created_by | Sender/admin/driver when available. |
| related_trip_id | Optional trip link. |
| title | Notification title. |
| message | Body. |
| type | `booking`, `trip_reminder`, `schedule_change`, `delay`, `issue`, `emergency`, `cancellation`, `system`. |
| priority | `normal`, `high`, `urgent`. |
| read_at | Read timestamp. |
| expires_at | Optional expiry timestamp. |

## 9. Core Services

### BookingCapacityService

- Selects the best available trip in a same-time slot.
- Counts same-time scheduled trips.
- Determines whether fleet rebalancing is needed.
- Enforces available seat checks.

### NotificationDispatchService

- Creates notification records.
- Deduplicates active recipients.
- Dispatches notification events.
- Sends to trip passengers and optionally drivers.

## 10. API Contract

### Auth

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Authenticated Passenger/User

```txt
GET  /api/locations
GET  /api/locations/{location}
GET  /api/profile
PUT  /api/profile
GET  /api/trips/upcoming
GET  /api/bookings
POST /api/bookings
GET  /api/bookings/{booking}
POST /api/bookings/{booking}/cancel
GET  /api/notifications
POST /api/notifications/{notification}/read
POST /api/notifications/read-all
```

### Admin

```txt
GET    /api/admin/dashboard
GET    /api/admin/roles
GET    /api/admin/buses
POST   /api/admin/buses
GET    /api/admin/buses/{bus}
PUT    /api/admin/buses/{bus}
DELETE /api/admin/buses/{bus}
GET    /api/admin/drivers
POST   /api/admin/drivers
GET    /api/admin/drivers/{driver}
PUT    /api/admin/drivers/{driver}
DELETE /api/admin/drivers/{driver}
POST   /api/admin/locations
PUT    /api/admin/locations/{location}
DELETE /api/admin/locations/{location}
GET    /api/admin/trips
POST   /api/admin/trips
POST   /api/admin/trips/bulk
GET    /api/admin/trips/{trip}
PUT    /api/admin/trips/{trip}
DELETE /api/admin/trips/{trip}
GET    /api/admin/trips/{trip}/bookings
POST   /api/admin/trips/{trip}/cancel
POST   /api/admin/bookings/{booking}/confirm
POST   /api/admin/bookings/{booking}/cancel
```

### Driver

```txt
GET  /api/driver/trips
GET  /api/driver/trips/{trip}
POST /api/driver/trips/{trip}/start
POST /api/driver/trips/{trip}/passengers/{booking}/status
POST /api/driver/trips/{trip}/complete
```

## 11. Frontend Screens

### Shared

- Login
- Register
- Notifications
- Profile
- Responsive app shell with collapsible sidebar

### Admin

- Dashboard
- Trips
- Bookings
- Buses
- Drivers
- Locations

### Passenger

- Bookings
- Tracking placeholder/Phase 2 tracking surface
- Notifications
- Profile

### Driver

- Driver Trips
- Notifications
- Profile

## 12. Business Rules

- Users can only have one active booking for the same date/time/direction.
- Bookings cannot be created after `confirmation_deadline`.
- Bookings cannot be cancelled after the trip is no longer scheduled.
- Backend chooses a trip inside a same-time slot by available seats and lowest confirmed count.
- Confirmed bookings consume seats.
- Single-bus cycles expose the bus code immediately.
- Multi-bus cycles require fleet rebalancing before final bus certainty.
- Admin trip creation requires active bus, active driver, route start, and route end.
- A bus cannot be double-booked for the same date and time.
- A driver cannot be double-booked for the same date and time.
- Driver start is blocked before the local operations date reaches `trip_date`.
- Completion marks remaining confirmed bookings as completed.

## 13. Environment Variables

Backend essentials:

```txt
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
OPERATIONS_TIMEZONE=Asia/Yangon
DB_CONNECTION=sqlite or pgsql
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DEFAULT_ADMIN_EMAIL=admin@ferrybus.local
DEFAULT_ADMIN_PASSWORD=password
```

Frontend essentials:

```txt
VITE_API_BASE_URL=http://localhost:8000/api
VITE_OPERATIONS_TIMEZONE=Asia/Yangon
```

## 14. Seed Data

The seeder must create:

- Roles: admin, driver, user.
- Default admin from environment values.
- Optional ten Yangon sample locations when `SEED_SAMPLE_DATA=true`.
- Optional ten active sample passengers with `password` as the password when `SEED_SAMPLE_DATA=true`.
- Optional user profiles with default pickup/drop-off locations for the sample passengers.

## 15. Testing And Verification

Backend:

```txt
php artisan test
vendor/bin/pint --test
```

Frontend:

```txt
npm run lint
npm run test -- --run
npm run build
```

Minimum test coverage:

- Authentication and role authorization.
- Data model migrations.
- Admin CRUD and duplicate validation.
- Booking capacity and single/multi bus behavior.
- Admin booking actions.
- Driver start/complete rules.
- Notification read and read-all.

## 16. Phase 1 Acceptance Criteria

- Users, admins, and drivers can authenticate.
- Role-based API access works.
- Admins can manage buses, drivers, locations, and trips.
- Admins can create trips over selected date ranges after reviewing editable drafts.
- Duplicate bus/driver trip assignments are rejected.
- Passengers can book and cancel available cycles.
- Single-bus cycle booking messages include the bus code.
- Multi-bus cycle booking messages defer assignment until fleet rebalancing.
- Seat capacity is enforced.
- Drivers can view assigned trips, initialize valid trips, and complete missions.
- Notifications are created and readable in the frontend.
- The project can be reset with `php artisan migrate:fresh --seed`.
