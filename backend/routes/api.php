<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AgentsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\ArticleController;
use App\Http\Controllers\InventaireController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;

// Broadcasting auth for token-based (React SPA / Flutter)
Route::post('/broadcasting/auth', function (\Illuminate\Http\Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

// inscription
Route::post('/register', [AuthController::class, 'register']);

// connexion
Route::post('/login', [AuthController::class, 'login']);
Route::post('/agent/login', [AgentsController::class, 'login']);


// Password Reset Routes
Route::post('/forgot-password', [\App\Http\Controllers\PasswordResetController::class, 'sendResetLinkEmail']);
Route::post('/reset-password', [\App\Http\Controllers\PasswordResetController::class, 'reset']);

// routes protégées
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // User profile
    Route::put('/user/profile', [UserController::class, 'updateProfile']);
    Route::post('/user/avatar', [UserController::class, 'uploadAvatar']);

    Route::prefix('agents')->group(function () {
        Route::get('/stats', [AgentsController::class, 'stats']);
        Route::get('/inventories', [InventaireController::class, 'agentInventories']);
        Route::post('/bulk-delete', [AgentsController::class, 'bulkDelete']);
        Route::get('/', [AgentsController::class, 'index']);
        Route::post('/', [AgentsController::class, 'store']);
        Route::get('/{id}', [AgentsController::class, 'getAgents']);
        Route::put('/{id}', [AgentsController::class, 'update']);
        Route::delete('/{id}', [AgentsController::class, 'destroy']);
        Route::post('/{id}/assign', [AgentsController::class, 'assignInventory']);
        Route::delete('/{id}/assign/{inventaireId}', [AgentsController::class, 'removeAssignment']);
    });

    // Stock Actif
    Route::prefix('stock')->group(function () {
        Route::get('/articles/stats', [ArticleController::class, 'stats']);
        Route::post('/articles/import', [ArticleController::class, 'import']);
        Route::get('/articles', [ArticleController::class, 'index']);
        Route::post('/articles', [ArticleController::class, 'store']);
        Route::put('/articles/{id}', [ArticleController::class, 'update']);
        Route::delete('/articles/{id}', [ArticleController::class, 'destroy']);
        Route::post('/articles/bulk-delete', [ArticleController::class, 'bulkDelete']);
        Route::post('/articles/attach-categories', [ArticleController::class, 'attachCategories']);
        Route::post('/articles/attach-entrepots', [ArticleController::class, 'attachEntrepots']);

        Route::get('/entrepots', [StockController::class, 'getEntrepots']);
        Route::post('/entrepots', [StockController::class, 'createEntrepot']);
        Route::put('/entrepots/{id}', [StockController::class, 'updateEntrepot']);
        Route::get('/entrepots/{id}/check', [StockController::class, 'checkEntrepot']);
        Route::delete('/entrepots/{id}', [StockController::class, 'deleteEntrepot']);

        Route::get('/categories', [StockController::class, 'getCategories']);
        Route::post('/categories', [StockController::class, 'createCategory']);
        Route::put('/categories/{id}', [StockController::class, 'updateCategory']);
        Route::delete('/categories/{id}', [StockController::class, 'deleteCategory']);
    });

    // Inventaires
    Route::prefix('inventaires')->group(function () {
        Route::get('/stats', [InventaireController::class, 'statistics']);
        Route::get('/proposed-articles', [InventaireController::class, 'getProposedArticles']);
        Route::get('/', [InventaireController::class, 'index']);
        Route::post('/', [InventaireController::class, 'store']);
        Route::get('/{id}', [App\Http\Controllers\InventaireController::class, 'show']);
        Route::put('/{id}', [App\Http\Controllers\InventaireController::class, 'update']);
        Route::delete('/{id}', [App\Http\Controllers\InventaireController::class, 'destroy']);
        Route::post('/{id}/lignes', [App\Http\Controllers\InventaireController::class, 'addLigne']);
        Route::post('/{id}/assign', [App\Http\Controllers\InventaireController::class, 'assignAgent']);
        Route::post('/{id}/start', [App\Http\Controllers\InventaireController::class, 'startInventaire']);
        Route::post('/{id}/scan', [App\Http\Controllers\InventaireController::class, 'scanBarcode']);
        Route::post('/{id}/stop', [App\Http\Controllers\InventaireController::class, 'stopInventaire']);
        Route::get('/{id}/summary', [App\Http\Controllers\InventaireController::class, 'getSummary']);
        Route::post('/{id}/terminate', [App\Http\Controllers\InventaireController::class, 'terminate']);
        Route::post('/{id}/propose-article', [App\Http\Controllers\InventaireController::class, 'proposeArticle']);
        Route::put('/accept-article/{id}', [App\Http\Controllers\InventaireController::class, 'acceptArticle']);
        
        // Notes
        Route::get('/{id}/notes', [InventaireController::class, 'getNotes']);
        Route::post('/{id}/notes', [InventaireController::class, 'addNote']);
        Route::put('/notes/{id}/read', [InventaireController::class, 'markNoteAsRead']);
        Route::put('/notes/{id}', [InventaireController::class, 'updateNote']);
        Route::delete('/notes/{id}', [InventaireController::class, 'deleteNote']);
    });

    // Corrections
    Route::get('/corrections', [\App\Http\Controllers\CorrectionController::class, 'index']);
    Route::post('/corrections', [\App\Http\Controllers\CorrectionController::class, 'store']);
    Route::put('/corrections/{id}/validate', [\App\Http\Controllers\CorrectionController::class, 'validateCorrection']);

    // Rapports / Historique
    Route::get('/rapports', [InventaireController::class, 'getRapports']);
});
