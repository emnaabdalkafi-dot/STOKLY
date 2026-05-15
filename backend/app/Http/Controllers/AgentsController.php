<?php

namespace App\Http\Controllers;

use App\Services\AgentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class AgentsController extends Controller
{
    protected $agentService;

    public function __construct(AgentService $agentService)
    {
        $this->agentService = $agentService;
    }

    // ─────────────────────────────────────────
    //  GET /agents/stats
    // ─────────────────────────────────────────
    public function stats()
    {
        return response()->json([
            'success' => true,
            'data'    => $this->agentService->getStats(),
        ]);
    }

    // ─────────────────────────────────────────
    //  GET /agents  — Liste avec filtres
    // ─────────────────────────────────────────
    public function index(Request $request)
    {
        $agents = $this->agentService->getAllAgents(
            $request->only(['search', 'status', 'inventaire_id'])
        );

        return response()->json([
            'success' => true,
            'data'    => $agents,
        ]);
    }

    // ─────────────────────────────────────────
    //  GET /agents/{id}
    // ─────────────────────────────────────────
    public function getAgents($id)
    {
        $agent = $this->agentService->findAgentById($id);

        if (!$agent) {
            return response()->json([
                'success' => false,
                'message' => 'Agent non trouvé',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $agent,
        ]);
    }

    // ─────────────────────────────────────────
    //  POST /agents
    // ─────────────────────────────────────────
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nom'      => 'required|string|max:255',
            'prenom'   => 'required|string|max:255',
            'email'    => 'required|email|unique:utilisateurs,email',
            'tel'      => 'nullable|string|max:20',
            'password' => 'nullable|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $result = $this->agentService->createAgent($request->all());

return response()->json([
    'success' => true,
    'message' => 'Agent créé avec succès',
    'data' => $result['agent'],
    'password' => $result['password'],
], 201);
    }

    // ─────────────────────────────────────────
    //  PUT /agents/{id}
    // ─────────────────────────────────────────
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'nom'      => 'sometimes|string|max:255',
            'prenom'   => 'sometimes|string|max:255',
            'email'    => 'sometimes|email|unique:utilisateurs,email,' . $id,
            'tel'      => 'nullable|string|max:20',
            'password' => 'nullable|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $agent = $this->agentService->updateAgent($id, $request->all());

        if (!$agent) {
            return response()->json([
                'success' => false,
                'message' => 'Agent non trouvé',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Agent mis à jour avec succès',
            'data'    => $agent,
        ]);
    }

    // ─────────────────────────────────────────
    //  DELETE /agents/{id}
    // ─────────────────────────────────────────
    public function destroy($id)
    {
        $deleted = $this->agentService->deleteAgent($id);

        if (!$deleted) {
            return response()->json([
                'success' => false,
                'message' => 'Agent non trouvé',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Agent supprimé avec succès',
        ]);
    }

    public function bulkDelete(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        \App\Models\User::whereIn('id', $request->ids)->where('role', 'agent')->delete();
        return response()->json([
            'success' => true,
            'message' => count($request->ids) . ' agents supprimés avec succès',
        ]);
    }

    // ─────────────────────────────────────────
    //  POST /agents/{id}/assign
    // ─────────────────────────────────────────
    public function assignInventory(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'inventaire_id'        => 'required|integer|exists:inventaires,id_inventaire',
            'statut_participation' => 'nullable|string|in:actif,inactif',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $affectation = $this->agentService->assignInventory(
            $id,
            $request->inventaire_id,
            $request->statut_participation ?? 'actif'
        );

        if (!$affectation) {
            return response()->json([
                'success' => false,
                'message' => 'Agent non trouvé',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Agent affecté à l\'inventaire avec succès',
            'data'    => $affectation,
        ]);
    }

    // ─────────────────────────────────────────
    //  DELETE /agents/{id}/assign/{inventaireId}
    // ─────────────────────────────────────────
    public function removeAssignment($id, $inventaireId)
    {
        $removed = $this->agentService->removeAssignment($id, $inventaireId);

        if (!$removed) {
            return response()->json([
                'success' => false,
                'message' => 'Affectation non trouvée',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Affectation supprimée avec succès',
        ]);
    }
    //login agent
    public function login(Request $request)
    {
        try {
            $validated = $request->validate([
                'email' => 'required|email',
                'password' => 'required|string',
            ]);

            $result = $this->agentService->login(
    $validated['email'],
    $validated['password']
);

            return response()->json($result, $result['success'] ? 200 : 401);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur de validation',
                'errors' => $e->errors(),
            ], 422);
        }
    }
}
