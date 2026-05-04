# Ferry Bus Management System

Phase 2 development is implemented with a Laravel API backend and a JavaScript-only React frontend.

## Project Structure

```txt
backend/    Laravel API
frontend/   React JS + Vite app
```

## Feature Guides

```txt
DRIVER_ROUTE_PLANNING_GUIDE.md    Driver best-route planning with Mapbox
UI_POLISH_NOTES.md                 UI quality pass and database reset notes
```

## Backend Quick Start

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

The backend runs at `http://localhost:8000` by default.

## Supabase Postgres Setup

Laravel is configured to connect to Supabase as a normal PostgreSQL database.

Before connecting to Supabase, make sure your PHP installation has PostgreSQL support enabled:

```bash
php -m | findstr pgsql
```

You should see `pdo_pgsql` and/or `pgsql`. If nothing appears, enable the PostgreSQL extensions in your PHP configuration before running Laravel against Supabase.

1. Create a Supabase project.
2. In Supabase, open the project dashboard and choose `Connect`.
3. Copy the `Session Pooler` connection details.
4. Copy `backend/.env.supabase.example` to `backend/.env`.
5. Fill in these values:

```txt
DB_CONNECTION=pgsql
DB_HOST=aws-0-your-region.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.your-project-ref
DB_PASSWORD=your-supabase-database-password
DB_SCHEMA=public
DB_SSLMODE=require
```

Then run:

```bash
cd backend
php artisan key:generate
php artisan migrate --seed
```

For a stricter production setup, you can create a dedicated schema in Supabase, set `DB_SCHEMA=ferry_app`, and run Laravel migrations there.

## Frontend Quick Start

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

## Default Admin

The backend seeder creates a default admin account for local development:

```txt
Email: admin@ferrybus.local
Password: password
```

You can override these values in `backend/.env`:

```txt
DEFAULT_ADMIN_NAME="System Admin"
DEFAULT_ADMIN_EMAIL=admin@ferrybus.local
DEFAULT_ADMIN_PASSWORD=password
```

## Reset Database From Scratch

Use this when you want to wipe local test data and rebuild the database from migrations and seeders:

```bash
cd backend
php artisan migrate:fresh --seed
```

This removes existing local data, recreates every table, and seeds only the default roles plus the default admin account.

## Optional Sample Locations

Set `SEED_SAMPLE_DATA=true` in `backend/.env` when you want the seeder to create ten Yangon route-planning locations for testing:

```txt
Pearl Condo
Thunandar Junction
South Okkalapa Pagoda
Bahan 3rd street
7/8 Junction
Kabar Aye Gamone Pwint
Insein Park
Hledan Center
8 mile Junction
Sule Square
```

These are inserted idempotently by name, so rerunning `php artisan db:seed` with `SEED_SAMPLE_DATA=true` updates existing sample coordinates instead of creating duplicates.

## Optional Sample Passengers

When `SEED_SAMPLE_DATA=true`, the seeder also creates ten active passenger accounts for route-planning tests:

```txt
passenger01@ferrybus.local
passenger02@ferrybus.local
passenger03@ferrybus.local
passenger04@ferrybus.local
passenger05@ferrybus.local
passenger06@ferrybus.local
passenger07@ferrybus.local
passenger08@ferrybus.local
passenger09@ferrybus.local
passenger10@ferrybus.local
```

All sample passengers use this password:

```txt
password
```

Each passenger has a default pickup and drop-off profile using the seeded sample locations.

## Current Phase 1 Rules

- The app name is Ferry Bus Management System.
- Users, admins, and drivers are stored in `users`; their permissions come from a separate `roles` table through `users.role_id`.
- Admins manually assign passengers to buses in Phase 1.
- Each user can only have one active booking per trip.
- Pickup and drop-off locations start simple and can gain latitude/longitude later.
- Phase 1 notifications are stored in-app only.

## Completed Phase 2 Features

```txt
Admin:
- Real-time operations dashboard
- Active trip monitoring with latest bus location
- Mapbox Geocoder location registration with Myanmar/Yangon search bounds and map pin reverse lookup
- Open driver issue review and resolution
- Emergency trip cancellation
- Notification creation by audience or trip

Passenger:
- Live tracking for confirmed active bookings
- Planned route display from booked pickup and drop-off coordinates
- ETA, delay, and trip status visibility
- Improved booking history with trip duration

Driver:
- Mapbox-powered best route plan for current passenger destinations
- Numbered route stop order with planned route line
- GPS/location update submission
- Operational status updates
- Delay and ETA updates
- Issue reporting

System:
- In-app notifications for booking, reminder, delay, schedule change, cancellation, issue, and emergency events
- Trip reminder command
- Reverb/Echo-ready event classes with frontend polling fallback
```

## UI Quality Pass

The frontend now uses a cleaner operations-focused visual system on top of Tailwind CSS:

```txt
- Premium app shell with dark sidebar navigation and clearer page headers
- Shared PageHeader, MetricCard, and SectionPanel components
- Polished login and registration screens
- Refined dashboard, operations, booking, notification, trip setup, passenger tracking, and driver route-planning screens
- Better form controls, table hover states, cards, shadows, spacing, and responsive behavior
```

No TypeScript was added. No new UI framework was added because Tailwind CSS is already in the stack and is enough for this JavaScript-only app.

The admin `Locations` register page uses Mapbox Search JS Geocoder with a Mapbox GL JS map. Search selections move the map and place a Mapbox marker, while manual map pin clicks use Mapbox reverse geocoding to fill address and coordinates.

Configure the frontend Mapbox token:

```txt
VITE_MAPBOX_TOKEN=your-mapbox-public-token
VITE_MAPBOX_STYLE=mapbox://styles/mapbox/streets-v12
```

Driver best-route planning uses Mapbox Optimization API through the Laravel backend. Configure:

```txt
MAPBOX_ACCESS_TOKEN=your-mapbox-token
MAPBOX_OPTIMIZATION_PROFILE=mapbox/driving
```

For fixed company/base starts, create the company location in `Locations`, then select it as `Route Start` when creating the trip. For example, an after-work drop-off trip can start from `Paeral Condo` and optimize the passenger home destinations.

Laravel Reverb could not be installed in this workspace because Composer could not reach Packagist during development. The backend is broadcast-event ready and uses `BROADCAST_CONNECTION=log` by default. When Packagist is reachable, run:

```bash
cd backend
composer require laravel/reverb predis/predis
php artisan reverb:install
```

## Completed Phase 1 Screens

```txt
Admin:
- Dashboard
- Trip management
- Booking review and confirmation
- Bus management
- Driver management
- Location management
- Notifications
- Profile

Passenger:
- Dashboard
- Upcoming trips and bookings
- Booking history
- Notifications
- Profile with default pickup/drop-off locations

Driver:
- Dashboard
- Assigned trips
- Passenger checklist
- Trip start/completion
- Notifications
- Profile
```

## Phase 1 Verification

```txt
Backend tests: passing
Frontend tests: passing
Frontend lint: passing
Frontend build: passing
Laravel Pint formatting: passing
```

## Phase 2 Verification

```txt
Backend tests: passing, 16 tests / 85 assertions
Frontend tests: passing
Frontend lint: passing
Frontend build: passing
Laravel Pint formatting: passing
Local backend health check: passing
Local frontend health check: passing
Admin operations API smoke test: passing
```

## Current API Endpoints

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout

GET  /api/locations
GET  /api/locations/{location}
GET  /api/profile
PUT  /api/profile
GET  /api/trips/upcoming
GET  /api/bookings
POST /api/bookings
GET  /api/bookings/{booking}
POST /api/bookings/{booking}/cancel
GET  /api/tracking/active
GET  /api/tracking/trips/{trip}
GET  /api/notifications
POST /api/notifications/{notification}/read
POST /api/notifications/read-all

GET    /api/admin/dashboard
GET    /api/admin/operations
POST   /api/admin/issues/{issue}/resolve
GET    /api/admin/notifications
POST   /api/admin/notifications
GET    /api/admin/roles
POST   /api/admin/locations
PUT    /api/admin/locations/{location}
DELETE /api/admin/locations/{location}
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
GET    /api/admin/trips
POST   /api/admin/trips
GET    /api/admin/trips/{trip}
PUT    /api/admin/trips/{trip}
DELETE /api/admin/trips/{trip}
GET    /api/admin/trips/{trip}/bookings
POST   /api/admin/trips/{trip}/cancel
POST   /api/admin/bookings/{booking}/confirm
POST   /api/admin/bookings/{booking}/cancel

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

The frontend stores the returned Sanctum bearer token in local storage during early Phase 1 development.
