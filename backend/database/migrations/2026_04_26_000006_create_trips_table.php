<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table): void {
            $table->id();
            $table->date('trip_date')->index();
            $table->time('departure_time');
            $table->string('direction')->index();
            $table->timestamp('confirmation_deadline')->nullable();
            $table->foreignId('bus_id')->nullable()->constrained('buses')->nullOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('route_start_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('route_end_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->string('status')->default('scheduled')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['trip_date', 'departure_time', 'direction']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
