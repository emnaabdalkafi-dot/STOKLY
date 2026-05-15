<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\UserService;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    protected $service;

    public function __construct(UserService $service)
    {
        $this->service = $service;
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'nom'              => 'sometimes|string|max:255',
            'prenom'           => 'sometimes|string|max:255',
            'email'            => 'sometimes|email|unique:utilisateurs,email,' . $user->id,
            'tel'              => 'nullable|string|max:20',
            'password'         => 'nullable|string|min:6|confirmed',
            'current_password' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $updatedUser = $this->service->updateProfile($user, $request->all());
            return response()->json([
                'success' => true,
                'message' => 'Profil mis à jour avec succès',
                'data'    => $updatedUser,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'errors'  => ['current_password' => [$e->getMessage()]],
            ], $e->getCode() ?: 400);
        }
    }

    public function uploadAvatar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'avatar' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $avatarUrl = $this->service->uploadAvatar($user, $request->file('avatar'));

        return response()->json([
            'success' => true,
            'message' => 'Avatar mis à jour avec succès',
            'data'    => [
                'avatar' => $avatarUrl,
                'user'   => $user->refresh(),
            ],
        ]);
    }
}
