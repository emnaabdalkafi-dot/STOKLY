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
        if (Schema::hasColumn('notifications', 'id_user')) {
            Schema::table('notifications', function (Blueprint $table) {
                // Attempt to drop foreign key if present (silently ignore errors)
                try {
                    $table->dropForeign(['id_user']);
                } catch (\Throwable $e) {
                    // ignore if constraint does not exist
                }

                try {
                    $table->dropColumn('id_user');
                } catch (\Throwable $e) {
                    // ignore if column removal fails for DB-specific reasons
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasColumn('notifications', 'id_user')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->unsignedBigInteger('id_user')->nullable()->after('id_article');
                $table->foreign('id_user')->references('id')->on('utilisateurs')->onDelete('cascade');
            });
        }
    }
};
