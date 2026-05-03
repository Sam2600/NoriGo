<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_list_and_mark_own_notifications_as_read(): void
    {
        $user = $this->userWithRole('user');

        $notification = Notification::query()->create([
            'user_id' => $user->id,
            'title' => 'Booking confirmed',
            'message' => 'Your booking is confirmed.',
            'type' => 'booking',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('data.0.title', 'Booking confirmed');

        $this->postJson("/api/notifications/{$notification->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $notification->id);

        $this->assertNotNull($notification->refresh()->read_at);
    }

    public function test_user_cannot_mark_another_users_notification_as_read(): void
    {
        $owner = $this->userWithRole('user', ['email' => 'owner@example.com']);
        $other = $this->userWithRole('user', ['email' => 'other@example.com']);
        $notification = Notification::query()->create([
            'user_id' => $owner->id,
            'title' => 'Private',
            'message' => 'Private message',
            'type' => 'system',
        ]);

        Sanctum::actingAs($other);

        $this->postJson("/api/notifications/{$notification->id}/read")
            ->assertNotFound();
    }

    private function userWithRole(string $roleName, array $attributes = []): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();

        return User::factory()->create([
            'role_id' => $role->id,
            ...$attributes,
        ]);
    }
}
