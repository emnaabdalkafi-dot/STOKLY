<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::all();
foreach ($users as $u) {
    echo "ID: " . $u->id . " | Name: " . $u->nom . " | Avatar: " . ($u->avatar ?? 'NULL') . "\n";
}
