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
        Schema::table('scans', function (Blueprint $table) {
            $table->unsignedBigInteger('id_entrepot')->nullable()->after('id_article');
            $table->foreign('id_entrepot')->references('id_entrepot')->on('entrepots')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('scans', function (Blueprint $table) {
            $table->dropForeign(['id_entrepot']);
            $table->dropColumn('id_entrepot');
        });
    }
};
