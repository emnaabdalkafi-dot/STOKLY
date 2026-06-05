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
        if (!Schema::hasColumn('notifications', 'id_note')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->unsignedBigInteger('id_note')->nullable()->after('id_article');
                $table->foreign('id_note')->references('id_note')->on('notes')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'id_note')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropForeign(['id_note']);
                $table->dropColumn('id_note');
            });
        }
    }
};
