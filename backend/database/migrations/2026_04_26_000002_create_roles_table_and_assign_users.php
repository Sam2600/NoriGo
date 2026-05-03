<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->string('display_name');
            $table->timestamps();
        });

        $now = now();

        DB::table('roles')->insert([
            ['name' => 'admin', 'display_name' => 'Admin', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'driver', 'display_name' => 'Driver', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'user', 'display_name' => 'User', 'created_at' => $now, 'updated_at' => $now],
        ]);

        $userRoleId = DB::table('roles')->where('name', 'user')->value('id');

        Schema::table('users', function (Blueprint $table) use ($userRoleId): void {
            $table->foreignId('role_id')->after('password')->default($userRoleId)->constrained();
        });

        foreach (['admin', 'driver', 'user'] as $roleName) {
            $roleId = DB::table('roles')->where('name', $roleName)->value('id');

            DB::table('users')
                ->where('role', $roleName)
                ->update(['role_id' => $roleId]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('role');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role')->default('user')->after('password');
        });

        foreach (['admin', 'driver', 'user'] as $roleName) {
            $roleId = DB::table('roles')->where('name', $roleName)->value('id');

            DB::table('users')
                ->where('role_id', $roleId)
                ->update(['role' => $roleName]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('role_id');
        });

        Schema::dropIfExists('roles');
    }
};
