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
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('quantite_theorique');
        });

        Schema::table('ligne_entrepots', function (Blueprint $table) {
            $table->integer('quantite_theorique')->default(0);
        });

        Schema::table('ligne_inventaires', function (Blueprint $table) {
            $table->unsignedBigInteger('id_entrepot')->nullable();
            $table->foreign('id_entrepot')->references('id_entrepot')->on('entrepots')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ligne_inventaires', function (Blueprint $table) {
            $table->dropForeign(['id_entrepot']);
            $table->dropColumn('id_entrepot');
        });

        Schema::table('ligne_entrepots', function (Blueprint $table) {
            $table->dropColumn('quantite_theorique');
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->integer('quantite_theorique')->default(0);
        });
    }
};
