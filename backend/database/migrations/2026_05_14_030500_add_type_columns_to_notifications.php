<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // First, change the column to string to avoid ENUM restrictions during update
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('type')->nullable()->change();
        });

        // Now redefine it with all needed types
        // Types: 'nouvel inventaire', 'article inconnu', 'demande de correction', 'inventaire depasse le date fin', 'agent actif', 'agent inactif', 'inventaire en cours', 'nouvelle note'
        $types = [
            'nouvel inventaire', 
            'article inconnu', 
            'demande de correction', 
            'inventaire depasse le date fin', 
            'agent actif', 
            'agent inactif', 
            'inventaire en cours', 
            'nouvelle note'
        ];
        
        $enumStr = "'" . implode("','", $types) . "'";
        DB::statement("ALTER TABLE notifications MODIFY COLUMN type ENUM($enumStr)");
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('type')->nullable()->change();
        });
    }
};
