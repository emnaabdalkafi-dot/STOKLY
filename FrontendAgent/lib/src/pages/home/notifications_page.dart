import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../../services/notification_service.dart';
import '../inventory/notes_list_page.dart';
import 'package:timeago/timeago.dart' as timeago;

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final NotificationService _notificationService = NotificationService();
  List<dynamic> _notifications = [];
  List<dynamic> _filteredNotifications = [];
  bool _isLoading = true;
  String? _errorMessage;
  final TextEditingController _searchController = TextEditingController();
  String _activeFilter = 'Tout';

  @override
  void initState() {
    super.initState();
    timeago.setLocaleMessages('fr', timeago.FrMessages());
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await _notificationService.getNotifications();
    if (mounted) {
      setState(() {
        if (result['success'] == true) {
          _notifications = result['data'] ?? [];
          _applyFiltersAndSearch();
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  void _applyFiltersAndSearch() {
    setState(() {
      _filteredNotifications = _notifications.where((notif) {
        final contenu = notif['contenu_decoded'] ?? {};
        final title = (contenu['titre'] ?? 'Inventaire').toString().toLowerCase();
        final message = (contenu['message'] ?? '').toString().toLowerCase();
        final query = _searchController.text.toLowerCase();
        
        final matchesSearch = title.contains(query) || message.contains(query);
        
        bool matchesFilter = true;
        if (_activeFilter == 'Notes') {
          matchesFilter = title.contains('note') || message.contains('note');
        } else if (_activeFilter == 'Inventaires') {
          matchesFilter = title.contains('inventaire') || message.contains('inventaire');
        }
        
        return matchesSearch && matchesFilter;
      }).toList();
    });
  }

  Future<void> _markAsRead(int id) async {
    final result = await _notificationService.markAsRead(id);
    if (result['success'] == true && mounted) {
      setState(() {
        final originalIndex = _notifications.indexWhere((n) => n['id_notification'] == id);
        if (originalIndex != -1) {
          _notifications[originalIndex]['statut'] = 1;
        }
        _applyFiltersAndSearch();
      });
    }
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Notifications', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary)),
                ClipRRect(
                  borderRadius: BorderRadius.circular(7), // Increased from 5
                  child: Image.asset(
                    'assets/images/logo.png',
                    width: 30,
                    height: 30,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30), // Circular
                border: Border.all(color: AppColors.darkBlueBorder, width: 1.2), // Dark blue border
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (_) => _applyFiltersAndSearch(),
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
                _filterChip('Tout'),
                const SizedBox(width: 8),
                _filterChip('Inventaires'),
                const SizedBox(width: 8),
                _filterChip('Notes'),
              ],
            ),
            const SizedBox(height: 14),
            Expanded(
              child: _isLoading 
                ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                : _errorMessage != null 
                  ? _buildErrorView()
                  : _filteredNotifications.isEmpty 
                    ? _buildEmptyView()
                    : _buildNotificationsList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String label) {
    final isActive = _activeFilter == label;
    return GestureDetector(
      onTap: () {
        setState(() => _activeFilter = label);
        _applyFiltersAndSearch();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? AppColors.accent : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isActive ? AppColors.accent : AppColors.primary, width: 1.2),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.grey,
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationsList() {
    return RefreshIndicator(
      onRefresh: _fetchNotifications,
      color: AppColors.accent,
      child: ListView.builder(
        itemCount: _filteredNotifications.length,
        itemBuilder: (context, index) {
          final notif = _filteredNotifications[index];
          final bool isUnread = notif['statut'] == 'non lu';
          final contenu = notif['contenu_decoded'] ?? {};
          final title = contenu['titre'] ?? 'Notification';
          final message = contenu['message'] ?? '';
          final dateStr = notif['created_at'] != null 
              ? timeago.format(DateTime.parse(notif['created_at']), locale: 'fr')
              : '';

          return GestureDetector(
            onTap: () {
              if (isUnread) {
                _markAsRead(notif['id_notification']);
              }
              
              final invId = contenu['id_inventaire'];
              final invTitre = contenu['inventaire_titre'] ?? contenu['titre'] ?? 'Inventaire';
              
              if (invId != null) {
                Navigator.push(
                  context, 
                  MaterialPageRoute(
                    builder: (context) => NotesListPage(
                      inventoryId: invId,
                      inventoryTitle: invTitre,
                    )
                  )
                );
              }
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
                                title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: AppColors.primary,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (isUnread)
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsets.only(right: 10),
                                decoration: const BoxDecoration(
                                  color: AppColors.accent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          message,
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 10),
                        ),
                        Text(
                          dateStr,
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none, size: 40, color: Colors.grey.shade400),
          const SizedBox(height: 10),
          Text(
            'Aucune notification',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 40, color: Colors.grey.shade400),
          const SizedBox(height: 10),
          Text(_errorMessage!, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
          const SizedBox(height: 10),
          ElevatedButton(
            onPressed: _fetchNotifications,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
            child: const Text('Réessayer', style: TextStyle(color: Colors.white, fontSize: 11)),
          ),
        ],
      ),
    );
  }
}

