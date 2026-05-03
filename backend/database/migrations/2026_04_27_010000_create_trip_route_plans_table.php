<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trip_route_plans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('trip_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('provider')->default('mapbox');
            $table->string('profile')->default('mapbox/driving');
            $table->string('status')->default('optimized')->index();
            $table->string('stops_hash')->index();
            $table->json('input_stops');
            $table->json('ordered_stops')->nullable();
            $table->json('route_geometry')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->unsignedInteger('distance_meters')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('optimized_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trip_route_plans');
    }
};
