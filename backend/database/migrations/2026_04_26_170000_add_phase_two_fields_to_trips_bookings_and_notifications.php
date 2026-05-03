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
            $table->string('operational_status')->default('scheduled')->after('status')->index();
            $table->unsignedSmallInteger('delay_minutes')->default(0)->after('operational_status');
            $table->timestamp('eta_at')->nullable()->after('delay_minutes');
            $table->text('status_note')->nullable()->after('eta_at');
            $table->timestamp('last_status_update_at')->nullable()->after('status_note');
            $table->boolean('is_emergency_cancelled')->default(false)->after('completed_at');
            $table->text('cancel_reason')->nullable()->after('is_emergency_cancelled');
            $table->foreignId('cancelled_by')->nullable()->after('cancel_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable()->after('cancelled_by');
        });

        Schema::table('bookings', function (Blueprint $table): void {
            $table->timestamp('trip_reminder_sent_at')->nullable()->after('cancelled_at');
        });

        Schema::table('notifications', function (Blueprint $table): void {
            $table->foreignId('created_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->foreignId('related_trip_id')->nullable()->after('created_by')->constrained('trips')->nullOnDelete();
            $table->string('priority')->default('normal')->after('type')->index();
            $table->timestamp('expires_at')->nullable()->after('read_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasIndex('notifications', 'notifications_priority_index')) {
            Schema::table('notifications', function (Blueprint $table): void {
                $table->dropIndex(['priority']);
            });
        }

        Schema::table('notifications', function (Blueprint $table): void {
            if (Schema::hasColumn('notifications', 'created_by')) {
                $table->dropConstrainedForeignId('created_by');
            }

            if (Schema::hasColumn('notifications', 'related_trip_id')) {
                $table->dropConstrainedForeignId('related_trip_id');
            }

            $columns = array_filter([
                Schema::hasColumn('notifications', 'priority') ? 'priority' : null,
                Schema::hasColumn('notifications', 'expires_at') ? 'expires_at' : null,
            ]);

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });

        if (Schema::hasColumn('bookings', 'trip_reminder_sent_at')) {
            Schema::table('bookings', function (Blueprint $table): void {
                $table->dropColumn('trip_reminder_sent_at');
            });
        }

        if (Schema::hasIndex('trips', 'trips_operational_status_index')) {
            Schema::table('trips', function (Blueprint $table): void {
                $table->dropIndex(['operational_status']);
            });
        }

        Schema::table('trips', function (Blueprint $table): void {
            if (Schema::hasColumn('trips', 'cancelled_by')) {
                $table->dropConstrainedForeignId('cancelled_by');
            }

            $columns = array_filter([
                Schema::hasColumn('trips', 'operational_status') ? 'operational_status' : null,
                Schema::hasColumn('trips', 'delay_minutes') ? 'delay_minutes' : null,
                Schema::hasColumn('trips', 'eta_at') ? 'eta_at' : null,
                Schema::hasColumn('trips', 'status_note') ? 'status_note' : null,
                Schema::hasColumn('trips', 'last_status_update_at') ? 'last_status_update_at' : null,
                Schema::hasColumn('trips', 'is_emergency_cancelled') ? 'is_emergency_cancelled' : null,
                Schema::hasColumn('trips', 'cancel_reason') ? 'cancel_reason' : null,
                Schema::hasColumn('trips', 'cancelled_at') ? 'cancelled_at' : null,
            ]);

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
