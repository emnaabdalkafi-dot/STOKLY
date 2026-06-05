<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            // id_user: the specific user (agent) this notification targets (nullable = admin-level)
            if (!Schema::hasColumn('notifications', 'id_user')) {
                $table->unsignedBigInteger('id_user')->nullable()->after('id_note');
                $table->foreign('id_user')->references('id')->on('utilisateurs')->onDelete('cascade');
            }
            // for_admin: flag to show this notification only to admin
            if (!Schema::hasColumn('notifications', 'for_admin')) {
                $table->boolean('for_admin')->default(false)->after('id_user');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'for_admin')) {
                $table->dropColumn('for_admin');
            }
            if (Schema::hasColumn('notifications', 'id_user')) {
                $table->dropForeign(['id_user']);
                $table->dropColumn('id_user');
            }
        });
    }
};
