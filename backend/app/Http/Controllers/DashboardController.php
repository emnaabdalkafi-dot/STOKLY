<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DashboardService;

class DashboardController extends Controller
{
    protected $service;

    public function __construct(DashboardService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $invId = $request->query('inv_id', 'all');
        $data = $this->service->getDashboardData($invId);
        return response()->json(['success' => true, 'data' => $data]);
    }
}
