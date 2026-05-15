<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('affectations', function (Blueprint $table) {
            $table->dropColumn('last_action_at');
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('statut');
        });

        Schema::table('corrections', function (Blueprint $table) {
            $table->dropColumn('motif_rejet');
        });

        Schema::table('notes', function (Blueprint $table) {
            $table->dropColumn('lu');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['id_type', 'action', 'message']);
            $table->renameColumn('id_agent', 'id_user');
            $table->foreign('id_user')->references('id')->on('utilisateurs')->onDelete('cascade');
        });
        
        // Enum changes require raw SQL in SQLite or doctrine/dbal for MySQL. 
        // We will just change them to string for simplicity, or we can use DB::statement.
        DB::statement("ALTER TABLE notifications MODIFY type ENUM('nouvel inventaire', 'article inconnu', 'demande de correction', 'inventaire depasse le date fin', 'agent actif')");
        DB::statement("ALTER TABLE notifications MODIFY statut ENUM('lu', 'non lu') DEFAULT 'non lu'");

        Schema::table('rapports', function (Blueprint $table) {
            $table->dropColumn(['taux_avancement', 'donnees_json']);
            $table->json('correction_details')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
