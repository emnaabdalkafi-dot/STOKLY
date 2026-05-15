<?php
$content = <<<'PHP'
<?php

namespace App\Http\Controllers;

use App\Services\AuthService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    public function register(Request $request)
    {
        try {
            $validated = $request->validate([
                'nom' => 'required|string|max:255',
                'prenom' => 'required|string|max:255',
                'email' => 'required|email|unique:utilisateurs,email',
                'password' => 'required|string|min:6',
                'tel' => 'nullable|string|max:20',
            ]);

            $result = $this->authService->register($validated);

            return response()->json($result, $result['success'] ? 201 : 500);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur de validation',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    public function login(Request $request)
    {
        try {
            $validated = $request->validate([
                'email' => 'required|email',
                'password' => 'required|string',
            ]);

            $result = $this->authService->login($validated);

            return response()->json($result, $result['success'] ? 200 : 401);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur de validation',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    public function me(Request $request)
    {
        $result = $this->authService->getCurrentUser($request->user());
        return response()->json($result);
    }

    public function logout(Request $request)
    {
        $result = $this->authService->logout($request->user());
        return response()->json($result, $result['success'] ? 200 : 500);
    }
}
PHP;

file_put_contents('app/Http/Controllers/AuthController.php', $content);
echo "AuthController restored successfully!";
