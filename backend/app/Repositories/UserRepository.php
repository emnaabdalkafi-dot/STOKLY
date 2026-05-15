<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserRepository
{
    /**
     * Find user by email
     */
    public function findByEmail($email)
    {
        return User::where('email', $email)->first();
    }

    /**
     * Find user by ID
     */
    public function findById($id)
    {
        return User::find($id);
    }

    /**
     * Create a new user
     */
    public function create($data)
    {
        return User::create([
            'nom' => $data['nom'],
            'prenom' => $data['prenom'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'tel' => $data['tel'] ?? null,
            'role' => $data['role'] ?? 'admin',
        ]);
    }

    /**
     * Update user
     */
    public function update($id, $data)
    {
        $user = $this->findById($id);
        if ($user) {
            $user->update($data);
        }
        return $user;
    }

    /**
     * Delete user
     */
    public function delete($id)
    {
        return User::destroy($id);
    }

    /**
     * Get all users
     */
    public function getAll()
    {
        return User::all();
    }

    /**
     * Verify password
     */
    public function verifyPassword($plainPassword, $hashedPassword)
    {
        return Hash::check($plainPassword, $hashedPassword);
    }
}
