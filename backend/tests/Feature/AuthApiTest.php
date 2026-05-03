<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New Passenger',
            'email' => 'passenger@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', 'passenger@example.com')
            ->assertJsonPath('user.role', 'user')
            ->assertJsonStructure(['token', 'token_type']);

        $userRoleId = Role::query()->where('name', 'user')->value('id');

        $this->assertDatabaseHas('users', [
            'email' => 'passenger@example.com',
            'role_id' => $userRoleId,
            'status' => 'active',
        ]);
    }

    public function test_user_can_login_and_fetch_current_user(): void
    {
        $driverRoleId = Role::query()->where('name', 'driver')->value('id');

        $user = User::factory()->create([
            'email' => 'driver@example.com',
            'password' => 'password123',
            'role_id' => $driverRoleId,
        ]);

        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'driver@example.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('token');

        $loginResponse
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'driver');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'driver@example.com');
    }

    public function test_inactive_user_cannot_login(): void
    {
        User::factory()->create([
            'email' => 'inactive@example.com',
            'password' => 'password123',
            'status' => 'inactive',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'inactive@example.com',
            'password' => 'password123',
        ])->assertUnprocessable();
    }

    public function test_user_can_logout_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertSame(0, PersonalAccessToken::query()->count());
    }
}
