<?php 
try { 
    $res = app(App\Services\InventaireService::class)->startInventaire(1, App\Models\User::first());
    echo 'SUCCESS';
} catch(\Exception $e) { 
    echo "ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString(); 
}
