import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../../services/inventory_service.dart';

class SyncStatusPage extends StatefulWidget {
  final int inventoryId;
  final String inventoryTitle;

  const SyncStatusPage({
    super.key,
    required this.inventoryId,
    required this.inventoryTitle,
  });

  @override
  State<SyncStatusPage> createState() => _SyncStatusPageState();
}

class _SyncStatusPageState extends State<SyncStatusPage> {
  final InventoryService _inventoryService = InventoryService();
  bool _isLoading = true;
  Map<String, dynamic> _stats = {};

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() => _isLoading = true);
    final stats = await _inventoryService.getSyncStats(widget.inventoryId);
    if (mounted) {
      setState(() {
        _stats = stats;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final unsyncedCount = _stats['unsyncedCount'] ?? 0;
    final totalArticles = _stats['totalArticles'] ?? 0;
    final syncedCount = _stats['syncedCount'] ?? 0;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.primary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          children: [
            const Text('Synchronisation', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 16)),
            Text(widget.inventoryTitle, style: const TextStyle(color: AppColors.accent, fontSize: 10, fontWeight: FontWeight.w500)),
          ],
        ),
        centerTitle: true,
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.backgroundStart, AppColors.backgroundEnd],
          ),
        ),
        child: SafeArea(
          child: _isLoading 
            ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
            : Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 10),
                    // Status Overview Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 15, offset: const Offset(0, 5))],
                      ),
                      child: Column(
                        children: [
                          Icon(
                            unsyncedCount == 0 ? Icons.cloud_done_rounded : Icons.sync_rounded,
                            size: 64,
                            color: unsyncedCount == 0 ? const Color(0xFF10B981) : AppColors.accent,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            unsyncedCount == 0 ? 'Données Synchronisées' : 'Synchronisation en cours',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            unsyncedCount == 0 
                              ? 'Toutes vos données sont en sécurité sur le cloud.'
                              : 'Certains scans sont en attente de téléchargement.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                    const Text('STATISTIQUES DE SESSION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 1.2)),
                    const SizedBox(height: 16),
                    
                    _buildStatCard('Articles en local', '$totalArticles', Icons.inventory_2_outlined, const Color(0xFF6366F1)),
                    _buildStatCard('Scans effectués', '$syncedCount', Icons.check_circle_outline_rounded, const Color(0xFF10B981)),
                    _buildStatCard('En attente de cloud', '$unsyncedCount', Icons.cloud_upload_outlined, const Color(0xFFF59E0B)),
                    
                    const Spacer(),
                    
                    if (unsyncedCount > 0)
                      Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.only(bottom: 24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.shade100),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: Colors.orange, size: 20),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                'Les données seront synchronisées dès que la connexion sera rétablie.',
                                style: TextStyle(fontSize: 12, color: Colors.orange.shade900, height: 1.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                    
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _loadStats,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: const Text('ACTUALISER LE STATUT', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5)),
                      ),
                    ),
                  ],
                ),
              ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 5)],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 16),
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 14, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: color),
          ),
        ],
      ),
    );
  }
}
