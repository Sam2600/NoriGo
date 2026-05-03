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
        Schema::create('trip_location_updates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('heading', 6, 2)->nullable();
            $table->decimal('speed_kmh', 7, 2)->nullable();
            $table->decimal('accuracy_meters', 8, 2)->nullable();
            $table->timestamp('eta_at')->nullable();
            $table->timestamp('reported_at')->index();
            $table->timestamps();

            $table->index(['trip_id', 'reported_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trip_location_updates');
    }
};
