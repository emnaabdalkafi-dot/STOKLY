import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../../services/inventory_service.dart';
import '../../widgets/custom_app_bar.dart';

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

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: CustomAppBar(
        title: 'Synchronisation ${widget.inventoryTitle}',
     
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
                   
                    
                    const SizedBox(height: 16),
                    
                    _buildStatCard('Articles en local', '$totalArticles', Icons.inventory_2_outlined, AppColors.primary),
                    _buildStatCard('Articles en attente de synchronisation', '$unsyncedCount', Icons.cloud_upload_outlined, AppColors.primary),
                    
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
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 2,
                        ),
                        child: const Text('Actualiser les données', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5)),
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
      margin: const EdgeInsets.only(bottom: 5),
      padding: const EdgeInsets.all(5),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(1),
           
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: AppColors.primary, fontSize: 14, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color),
          ),
        ],
      ),
    );
  }
}
