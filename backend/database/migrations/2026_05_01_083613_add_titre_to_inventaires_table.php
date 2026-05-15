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
            $table->string('titre')->nullable()->after('id_inventaire');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventaires', function (Blueprint $table) {
            $table->dropColumn('titre');
        });
    }
};
