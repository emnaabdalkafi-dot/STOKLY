<?php

namespace App\Http\Controllers;

use App\Services\CorrectionService;
use Illuminate\Http\Request;

class CorrectionController extends Controller
{
    protected $service;

    public function __construct(CorrectionService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $data = $this->service->listCorrections($request->statut);
        return response()->json(['success' => true, 'data' => $data]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'id_ligne_inventaire' => 'required|exists:ligne_inventaires,id_ligne',
            'qte' => 'required|numeric|min:0',
            'description' => 'required|string',
        ]);

        $correction = $this->service->requestCorrection($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'message' => 'Demande de correction envoyée.',
            'data' => $correction
        ], 201);
    }

    public function validateCorrection(Request $request, $id)
    {
        $request->validate([
            'statut' => 'required|in:valide,refuse',
        ]);

        $correction = $this->service->validateCorrection($id, $request->user(), $request->all());

        return response()->json([
            'success' => true,
            'message' => 'Demande de correction traitée.',
            'data' => $correction
        ]);
    }
}
