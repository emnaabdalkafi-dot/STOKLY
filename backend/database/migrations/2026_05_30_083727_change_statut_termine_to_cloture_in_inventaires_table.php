<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add cloture
        DB::statement("ALTER TABLE inventaires MODIFY COLUMN statut ENUM('en cours', 'en attente', 'termine', 'cloture') DEFAULT 'en attente'");
        // Update data
        DB::table('inventaires')->where('statut', 'termine')->update(['statut' => 'cloture']);
        // Remove termine
        DB::statement("ALTER TABLE inventaires MODIFY COLUMN statut ENUM('en cours', 'en attente', 'cloture') DEFAULT 'en attente'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE inventaires MODIFY COLUMN statut ENUM('en cours', 'en attente', 'cloture', 'termine') DEFAULT 'en attente'");
        DB::table('inventaires')->where('statut', 'cloture')->update(['statut' => 'termine']);
        DB::statement("ALTER TABLE inventaires MODIFY COLUMN statut ENUM('en cours', 'en attente', 'termine') DEFAULT 'en attente'");
    }
};
