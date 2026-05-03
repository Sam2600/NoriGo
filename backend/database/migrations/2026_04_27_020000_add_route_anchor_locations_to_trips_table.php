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
        Schema::table('trips', function (Blueprint $table): void {
            $table->foreignId('route_start_location_id')
                ->nullable()
                ->after('driver_id')
                ->constrained('locations')
                ->nullOnDelete();
            $table->foreignId('route_end_location_id')
                ->nullable()
                ->after('route_start_location_id')
                ->constrained('locations')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('route_start_location_id');
            $table->dropConstrainedForeignId('route_end_location_id');
        });
    }
};
