import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../services/inventory_service.dart';
import '../../services/websocket_service.dart';
import '../../services/notification_service.dart';
import '../../providers/user_provider.dart';
import '../profile/profile_view_page.dart';
import '../inventory/inventory_details_page.dart';
import 'notifications_page.dart';
import '../../widgets/custom_app_bar.dart';
class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}
class _HomePageState extends State<HomePage> {
  int _selectedIndex = 1;
  int _unreadCount = 0;
  final WebSocketService _wsService = WebSocketService();
  final NotificationService _notificationService = NotificationService();
  final GlobalKey<_InventoryListPageState> _inventoryListKey = GlobalKey<_InventoryListPageState>();
  late final List<Widget> _pages;
  @override
  void initState() {
    super.initState();
    _pages = [
      const NotificationsPage(),
      InventoryListPage(key: _inventoryListKey, onRefresh: _fetchUnreadCount),
      const ProfileViewPage(),
    ];
    _initWebSocket();
    _fetchUnreadCount();
  }
  Future<void> _fetchUnreadCount() async {
    final result = await _notificationService.getNotifications();
    if (result['success'] == true && mounted) {
      final List<dynamic> notifications = result['data'] ?? [];
      setState(() {
        _unreadCount = notifications.where((n) => n['statut'] == 'non lu').length;
      });
    }
  }
  final Map<int, String> _knownStatuses = {};
  Future<void> _initWebSocket() async {
    final user = Provider.of<UserProvider>(context, listen: false).user;
    if (user != null && user['id'] != null) {
      await _wsService.connect();
      await _wsService.subscribeToAgentChannel(
        user['id'],
        onStatusChanged: (data) {
          if (mounted) {
            final invId = data['id_inventaire'];
            final newStatus = data['statut'];
            
            if (invId != null && _knownStatuses[invId] != newStatus) {
              _knownStatuses[invId] = newStatus;
              _inventoryListKey.currentState?._fetchInventories();
              _fetchUnreadCount();
            } else {
              _inventoryListKey.currentState?._fetchInventories();
            }
          }
        },
        onAssigned: (data) {
          if (mounted) {
            _inventoryListKey.currentState?._fetchInventories();
            _fetchUnreadCount();
          }
        },
      );
    }
  }
  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
    if (index == 0) {
      // Clear count or refresh when clicking the tab
      _fetchUnreadCount();
    }
  }
  @override
  Widget build(BuildContext context) {
    String title = '';
    if (_selectedIndex == 0) title = 'Notifications';
    else if (_selectedIndex == 1) title = 'Liste des inventaires';
    else title = 'Profil';
    return Scaffold(
      backgroundColor: AppColors.backgroundStart,
            appBar: CustomAppBar(
        title: title,
        showBackButton: false,
      ),
      body: _pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        selectedItemColor: AppColors.accent,
        unselectedItemColor: AppColors.primary,
        showUnselectedLabels: true,
        items: [
          BottomNavigationBarItem(
            icon: Badge(
              label: Text('$_unreadCount'),
              isLabelVisible: _unreadCount > 0,
              child: const Icon(Icons.notifications_none),
            ),
            label: 'Notification',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Accueil'),
          const BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profil'),
        ],
      ),
    );
  }
}
class InventoryListPage extends StatefulWidget {
  final VoidCallback? onRefresh;
  const InventoryListPage({super.key, this.onRefresh});
  @override
  State<InventoryListPage> createState() => _InventoryListPageState();
}
class _InventoryListPageState extends State<InventoryListPage> {
  String _selectedStatus = '';
  final TextEditingController _searchController = TextEditingController();
  final InventoryService _inventoryService = InventoryService();
  List<dynamic> _inventories = [];
  bool _isLoading = true;
  String? _errorMessage;
  @override
  void initState() {
    super.initState();
    _fetchInventories();
  }
  Future<void> _fetchInventories() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final result = await _inventoryService.getInventories(
      status: _selectedStatus.isNotEmpty ? _selectedStatus : null,
      search: _searchController.text.isNotEmpty ? _searchController.text : null,
    );
    if (mounted) {
      setState(() {
        if (result['success'] == true) {
  List<dynamic> data = result['data'] ?? [];

  if (_selectedStatus.isEmpty) {
    data = data.where((inv) =>
      inv['statut'] == 'en cours' ||
      inv['statut'] == 'en attente'
    ).toList();
  }

  _inventories = data;
        } else {
          _errorMessage = result['message'] ?? 'Erreur inconnue';
          _inventories = [];
        }
        _isLoading = false;
      });
      if (widget.onRefresh != null) widget.onRefresh!();
    }
  }
  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final dt = DateTime.parse(iso);
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
  Color _statusColor(String? statut) {
switch (statut) {
  case 'en cours':
    return const Color(0xFF10B981); 
    
  case 'en attente':
    return const Color(0xFFF59E0B); 
    
  case 'cloture':
    return const Color(0xFFEF4444); 
    
  default:
    return Colors.grey;
}
  }
  String _typeLabel(Map<String, dynamic> item) {
    final type = item['type_source'] ?? '';
    if (type == 'tous') return 'Tous les articles';
    if (type == 'entrepot') {
      final name = item['entrepot']?['nom'] ?? '—';
      return 'Entrepôt ($name)';
    }
    if (type == 'article') {
      final count = (item['lignes'] as List?)?.length ?? 0;
      return 'Articles ($count)';
    }
    return type;
  }
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.backgroundStart, AppColors.backgroundEnd],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30), // Circular
                border: Border.all(color: AppColors.darkBlueBorder, width: 1.2), // Dark blue border
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (_) => _fetchInventories(),
                style: const TextStyle(fontSize: 12),
                decoration: const InputDecoration(
                  hintText: 'Recherche',
                  hintStyle: TextStyle(fontSize: 12),
                  icon: Icon(Icons.search, color: Colors.grey, size: 18),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _filterChip('Tous', _selectedStatus == '', () {
                  setState(() => _selectedStatus = '');
                  _fetchInventories();
                }),
                const SizedBox(width: 8),
                _filterChip('En cours', _selectedStatus == 'en cours', () {
                  setState(() => _selectedStatus = 'en cours');
                  _fetchInventories();
                }),
                const SizedBox(width: 8),
                _filterChip('En attente', _selectedStatus == 'en attente', () {
                  setState(() => _selectedStatus = 'en attente');
                  _fetchInventories();
                }),
              ],
            ),
            const SizedBox(height: 14),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                  : _errorMessage != null
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.cloud_off, size: 40, color: Colors.grey.shade400),
                              const SizedBox(height: 10),
                              Text(_errorMessage!, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
                              const SizedBox(height: 10),
                              ElevatedButton(
                                onPressed: _fetchInventories,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.accent,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)), // Increased from 4
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                ),
                                child: const Text('Réessayer', style: TextStyle(color: Colors.white, fontSize: 11)),
                              ),
                            ],
                          ),
                        )
                      : _inventories.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.inventory_2_outlined, size: 40, color: Colors.grey.shade400),
                                  const SizedBox(height: 10),
                                  Text('Aucun inventaire', style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _fetchInventories,
                              color: AppColors.accent,
                              child: ListView.builder(
                                itemCount: _inventories.length,
                                itemBuilder: (context, index) => _inventoryCard(_inventories[index]),
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
  Widget _filterChip(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isSelected ? AppColors.accent : AppColors.primary, width: 1.2),
        ),
        child: Text(
          label,
          style: TextStyle(color: isSelected ? Colors.white : Colors.grey, fontWeight: FontWeight.w600, fontSize: 11),
        ),
      ),
    );
  }
  Widget _inventoryCard(dynamic item) {
    final statut = item['statut'] ?? 'en attente';
    final statusColor = _statusColor(statut);
    return GestureDetector(
      onTap: () async {
        final inventoryId = item['id_inventaire'];
        if (inventoryId == null) return;
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => InventoryDetailsPage(inventoryId: inventoryId)),
        );
        _fetchInventories();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.accent.withOpacity(0.3), width: 1),
        ),
        child: Row(
          children: [
            
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                 Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,
  children: [
   
    Expanded( 
      child: Text(
        item['titre'] ?? '(sans titre)',
        style: const TextStyle(
          fontWeight: FontWeight.bold, 
          fontSize: 13, 
          color: AppColors.primary
        ),
        overflow: TextOverflow.ellipsis, 
      ),
    ),
    
    const SizedBox(width: 8), 
   
    Container(
      width: 8,
      height: 8,
      margin: const EdgeInsets.only(right: 10),
      decoration: BoxDecoration(
        color: statusColor, 
        shape: BoxShape.circle
      ),
    ),
  ],
),
                  const SizedBox(height: 2),
                  Text(
                    _typeLabel(item),
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 10),
                  ),
                  Text(
                    '${_formatDate(item['date_debut'])} → ${_formatDate(item['date_fin'])}',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 10),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}