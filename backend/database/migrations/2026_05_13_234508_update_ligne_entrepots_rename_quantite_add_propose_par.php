<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * - Rename quantite_theorique -> quantite
     * - Add propose_par (FK -> utilisateurs.id)
     */
    public function up(): void
    {
        Schema::table('ligne_entrepots', function (Blueprint $table) {
            // Rename quantite_theorique to quantite
            $table->renameColumn('quantite_theorique', 'quantite');

            // Add propose_par FK nullable
            $table->unsignedBigInteger('propose_par')->nullable()->after('quantite');
            $table->foreign('propose_par')
                  ->references('id')
                  ->on('utilisateurs')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ligne_entrepots', function (Blueprint $table) {
            $table->dropForeign(['propose_par']);
            $table->dropColumn('propose_par');
            $table->renameColumn('quantite', 'quantite_theorique');
        });
    }
};
