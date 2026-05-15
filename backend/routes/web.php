<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;

Route::get('/', function () {
    return view('welcome');

});
// page bienvenue
Route::middleware('auth')->group(function () {
    Route::get('/dashboard', function () {
        $user = Auth::user();
        return "Bienvenue " . $user->nom . " (" . $user->role . ")";
    });
});
// login
Route::get('/login', function () {
    return "Page login";
})->name('login');
// login forse
Route::get('/test-login', function () {
    Auth::loginUsingId(12345679);
    return "connected";
});
//deconecter
Route::post('/logout', function (Request $request) {
    Auth::logout();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/login');
})->name('logout');
//deconecter forcee
Route::get('/logout-test', function (Request $request) {
    Auth::logout();
    return "Déconnecté";
});
