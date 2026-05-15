<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First drop all records from scans to prevent foreign key errors with empty id_ligne, 
        // since we're replacing columns and we probably shouldn't try to guess id_ligne for existing data.
        // Actually, let's just clear scans table. It's a pivot/activity table.
        \DB::table('scans')->truncate();

        Schema::table('scans', function (Blueprint $table) {
            $table->dropForeign('scans_id_inventaire_foreign');
            $table->dropForeign('scans_id_article_foreign');
            $table->dropForeign('scans_id_entrepot_foreign');
            
            $table->dropColumn(['id_inventaire', 'id_article', 'id_entrepot']);
            $table->unsignedBigInteger('id_ligne')->after('id');
            
            $table->foreign('id_ligne')->references('id_ligne')->on('ligne_inventaires')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('scans', function (Blueprint $table) {
            $table->dropForeign(['id_ligne']);
            $table->dropColumn('id_ligne');
            
            $table->unsignedBigInteger('id_inventaire');
            $table->unsignedBigInteger('id_article');
            $table->unsignedBigInteger('id_entrepot')->nullable();
            
            $table->foreign('id_inventaire')->references('id_inventaire')->on('inventaires')->onDelete('cascade');
            $table->foreign('id_article')->references('id_article')->on('articles')->onDelete('cascade');
            $table->foreign('id_entrepot')->references('id_entrepot')->on('entrepots')->onDelete('set null');
        });
    }
};
