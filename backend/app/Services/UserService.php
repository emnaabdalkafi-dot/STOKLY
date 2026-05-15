<?php

namespace App\Services;

use App\Repositories\UserRepository;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class UserService
{
    protected $repository;

    public function __construct(UserRepository $repository)
    {
        $this->repository = $repository;
    }

    public function updateProfile($user, array $data)
    {
        if (!empty($data['password'])) {
            if (empty($data['current_password']) || !Hash::check($data['current_password'], $user->password)) {
                throw new \Exception('Mot de passe actuel incorrect', 422);
            }
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        unset($data['current_password']);
        unset($data['password_confirmation']);

        return $this->repository->update($user->id, $data);
    }

    public function uploadAvatar($user, $file)
    {
        if ($user->avatar && !str_starts_with($user->avatar, 'http')) {
            $oldPath = str_replace('/storage/', '', $user->avatar);
            Storage::disk('public')->delete($oldPath);
        }

        $path = $file->store('avatars', 'public');
        $avatarUrl = '/storage/' . $path;

        $this->repository->update($user->id, ['avatar' => $avatarUrl]);

        return $avatarUrl;
    }
}
