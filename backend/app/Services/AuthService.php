<?php

namespace App\Services;

use App\Repositories\UserRepository;
use Illuminate\Validation\ValidationException;


class AuthService
{
    protected $userRepository;

    public function __construct(UserRepository $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    /**
     * Register a new user
     */
    public function register($validated)
    {
        try {
            $user = $this->userRepository->create($validated);

            return [
                'success' => true,
                'message' => 'Utilisateur enregistré avec succès',
                'data' => $user,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Impossible de créer l\'utilisateur',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Login user
     */
    public function login($validated)
    {
        try {
            $user = $this->userRepository->findByEmail($validated['email']);

            if (!$user || !$this->userRepository->verifyPassword($validated['password'], $user->password)) {
                return [
                    'success' => false,
                    'message' => 'Identifiants incorrects',
                ];
            }

            // Check if user has admin role
            if ($user->role !== 'admin') {
                return [
                    'success' => false,
                    'message' => 'Accès refusé. Seuls les administrateurs peuvent se connecter.',
                ];
            }

            $token = $user->createToken('api_token')->plainTextToken;

            return [
                'success' => true,
                'message' => 'Connexion réussie',
                'data' => [
                    'user' => $user,
                    'token' => $token,
                ],
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Erreur serveur',
                'error' => $e->getMessage(),
            ];
        }
    }



    /**
     * Get current user
     */
    public function getCurrentUser($user)
    {
        try {
            return [
                'success' => true,
                'data' => $user,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Erreur lors de la récupération de l\'utilisateur',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Logout user
     */
    public function logout($user)
    {
        try {
            $user->currentAccessToken()->delete();

            return [
                'success' => true,
                'message' => 'Déconnexion réussie',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Erreur lors de la déconnexion',
                'error' => $e->getMessage(),
            ];
        }
    }
}
