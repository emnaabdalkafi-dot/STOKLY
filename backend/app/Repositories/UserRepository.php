<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserRepository
{
    public function findByEmail($email)
    {
        return User::where('email', $email)->first();
    }

    public function findById($id)
    {
        return User::find($id);
    }

    public function create($data)
    {
        return User::create([
            'nom' => $data['nom'],
            'prenom' => $data['prenom'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'tel' => $data['tel'] ?? null,
            'role' =>'admin',
        ]);
    }
    public function update($id, $data)
    {
        $user = $this->findById($id);
        if ($user) {
            $user->update($data);
        }
        return $user;
    }
    public function delete($id)
    {
        return User::destroy($id);
    }

    
    public function getAll()
    {
        return User::all();
    }

    public function verifyPassword($plainPassword, $hashedPassword)
    {
        return Hash::check($plainPassword, $hashedPassword);
    }
}
