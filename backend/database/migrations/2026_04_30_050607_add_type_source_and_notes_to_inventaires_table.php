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
        Schema::table('inventaires', function (Blueprint $table) {
            $table->string('type_source')->default('tous'); // 'tous', 'entrepot', 'article'
            $table->unsignedBigInteger('id_entrepot')->nullable();
            $table->text('notes')->nullable();

            $table->foreign('id_entrepot')->references('id_entrepot')->on('entrepots')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventaires', function (Blueprint $table) {
            $table->dropForeign(['id_entrepot']);
            $table->dropColumn(['type_source', 'id_entrepot', 'notes']);
        });
    }
};
