<?php

namespace App\Services;

use App\Repositories\AgentRepository;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use App\Mail\AgentRegistered;

class AgentService
{
    protected $agentRepository;

    public function __construct(AgentRepository $agentRepository)
    {
        $this->agentRepository = $agentRepository;
    }

    public function getAllAgents($filters = [])
    {
        return $this->agentRepository->searchAgents($filters);
    }

    public function searchAgents($filters = [])
    {
        return $this->agentRepository->searchAgents($filters);
    }

    public function findAgentById($id)
    {
        return $this->agentRepository->findAgentById($id);
    }

    public function getStats()
    {
        return $this->agentRepository->getStats();
    }

public function createAgent($data)
{
    $plainPassword = Str::password(10);
    $data['password'] = $plainPassword;
    $agent = $this->agentRepository->createAgent($data);
    
    // Envoyer l'email avec le mot de passe
    try {
        Mail::to($agent->email)->send(new AgentRegistered($agent, $plainPassword));
    } catch (\Exception $e) {
        \Log::error("Erreur lors de l'envoi de l'email à l'agent : " . $e->getMessage());
    }

    if (!empty($data['inventaire_id'])) {
        $this->agentRepository->assignInventory(
            $agent->id,
            $data['inventaire_id'],
            $data['statut_participation'] ?? 'actif'
        );
    }
    return [
        'agent' => $agent->load('affectations.inventaire'),
        'password' => $plainPassword
    ];
}

    public function updateAgent($id, $data)
    {
        $agent = $this->agentRepository->updateAgent($id, $data);

        if (!$agent) return null;

        if (!empty($data['inventaire_id'])) {
            $this->agentRepository->assignInventory(
                $id,
                $data['inventaire_id'],
                $data['statut_participation'] ?? 'actif'
            );
        }

        return $agent;
    }

    public function deleteAgent($id)
    {
        return $this->agentRepository->deleteAgent($id);
    }

    public function assignInventory($agentId, $inventaireId, $statut = 'actif')
    {
        $agent = $this->agentRepository->findAgentById($agentId);

        if (!$agent) return null;

        return $this->agentRepository->assignInventory($agentId, $inventaireId, $statut);
    }

    public function removeAssignment($agentId, $inventaireId)
    {
        return $this->agentRepository->removeAssignment($agentId, $inventaireId);
    }
public function login($email, $password)
{
    try {
        $user = $this->agentRepository->findByEmail($email);

        if (!$user || !Hash::check($password, $user->password)) {
            return [
                'success' => false,
                'message' => 'Identifiants incorrects',
            ];
        }

        if ($user->role !== 'agent') {
            return [
                'success' => false,
                'message' => 'Accès refusé. Seuls les agents peuvent se connecter.',
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
}
