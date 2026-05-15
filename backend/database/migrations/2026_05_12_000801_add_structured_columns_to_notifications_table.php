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
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('action')->nullable()->after('id_type');
            $table->unsignedBigInteger('id_inventaire')->nullable()->after('action');
            $table->unsignedBigInteger('id_article')->nullable()->after('id_inventaire');
            $table->unsignedBigInteger('id_agent')->nullable()->after('id_article');
            $table->text('message')->nullable()->after('id_agent');
            $table->text('contenu')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['action', 'id_inventaire', 'id_article', 'id_agent', 'message']);
            $table->text('contenu')->nullable(false)->change();
        });
    }
};
