import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';
import '../../widgets/project_cover_image.dart';
import '../../services/image_cache_service.dart';
import 'finance_tab.dart';
import 'connect_tab.dart';
import 'feed_tab.dart';
import 'users_tab.dart';

class ProjectProfileScreen extends StatefulWidget {
  final String projectDocId;
  const ProjectProfileScreen({super.key, required this.projectDocId});

  @override
  State<ProjectProfileScreen> createState() => _ProjectProfileScreenState();
}

class _ProjectProfileScreenState extends State<ProjectProfileScreen> {
  int _coverVersion = 0;
  bool _picking = false;

  @override
  void initState() {
    super.initState();
    ImageCacheService.I.syncPending();
  }

  Future<File> _compressMaxWidth(File input, int maxWidth) async {
    final dir = await getTemporaryDirectory();
    final outPath = '${dir.path}/cover_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final res = await FlutterImageCompress.compressAndGetFile(
      input.path,
      outPath,
      quality: 85,
      minWidth: maxWidth,
      keepExif: false,
    );
    return File(res?.path ?? input.path);
  }

  Future<void> _pickNewCover() async {
    if (_picking) return;
    _picking = true;
    try {
      final action = await showModalBottomSheet<String>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Wrap(children: [
            ListTile(leading: const Icon(Icons.photo), title: const Text('Choose from gallery'), onTap: () => Navigator.pop(ctx, 'gallery')),
            ListTile(leading: const Icon(Icons.photo_camera), title: const Text('Take a photo'), onTap: () => Navigator.pop(ctx, 'camera')),
            const SizedBox(height: 4),
          ]),
        ),
      );
      if (action == null) return;
      final picker = ImagePicker();
      final XFile? x = await picker.pickImage(source: action == 'camera' ? ImageSource.camera : ImageSource.gallery, maxWidth: 2000);
      if (x == null) return;
      final compressed = await _compressMaxWidth(File(x.path), 500);
      await ImageCacheService.I.setProjectLocalCover(widget.projectDocId, compressed.path);
      await ImageCacheService.I.queueProjectCoverUpload(file: compressed, projectDocId: widget.projectDocId);
      setState(() => _coverVersion++);
      ImageCacheService.I.syncPending();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updating cover image…')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to pick image: $e')));
    } finally {
      _picking = false;
    }
  }

  bool _canEdit(Map<String, dynamic> data) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return false;
    try {
      final team = (data['teamUids'] is List) ? List<String>.from(data['teamUids']) : const <String>[];
      if (team.contains(uid)) return true;
      final owner = (data['owner'] is Map) ? Map<String, dynamic>.from(data['owner']) : <String, dynamic>{};
      if (owner['type'] == 'user' && owner['uid'] == uid) return true;
    } catch (_) {}
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('projects').doc(widget.projectDocId).snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final data = snap.data!.data() ?? {};
        final name = (data['name'] ?? 'Project').toString();
        final cover = (data['coverPhotoUrl'] ?? '').toString();
        final canEdit = _canEdit(data);

        return DefaultTabController(
          length: 4,
          child: Scaffold(
            body: NestedScrollView(
              headerSliverBuilder: (context, inner) => [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 220,
                  title: null,
                  bottom: PreferredSize(
                    preferredSize: const Size.fromHeight(48),
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x00000000), Color(0x99000000)],
                        ),
                      ),
                      child: const TabBar(
                        tabs: [
                          Tab(text: 'Feed'),
                          Tab(text: 'Finance'),
                          Tab(text: 'Connect'),
                          Tab(text: 'Users'),
                        ],
                      ),
                    ),
                  ),
                  flexibleSpace: FlexibleSpaceBar(
                    background: Stack(
                      fit: StackFit.expand,
                      children: [
                        ProjectCoverImage(
                          key: ValueKey('cover-${widget.projectDocId}-v$_coverVersion'),
                          projectDocId: widget.projectDocId,
                          coverUrl: cover,
                          width: double.infinity,
                          height: double.infinity,
                          borderRadius: BorderRadius.zero,
                          fallback: Container(color: Colors.black12, child: const Center(child: Icon(Icons.photo, size: 48, color: Colors.white24))),
                          fit: BoxFit.cover,
                        ),
                        Container(color: Colors.black.withValues(alpha: 0.25)),
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: 64, // keep clear of the TabBar (48px) + spacing
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  shadows: const [Shadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 2))],
                                ) ?? const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                          ),
                        ),
                        if (canEdit)
                          SafeArea(
                            child: Align(
                              alignment: Alignment.topRight,
                              child: Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: IconButton.filledTonal(
                                  style: IconButton.styleFrom(
                                    backgroundColor: Colors.black.withValues(alpha: 0.35),
                                    foregroundColor: Colors.white,
                                  ),
                                  tooltip: 'Change cover photo',
                                  icon: const Icon(Icons.edit),
                                  onPressed: _pickNewCover,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
              body: TabBarView(
                children: [
                  FeedTab(
                    projectDocId: widget.projectDocId,
                    orgCode: (data['organizationId'] ?? '').toString(),
                    orgData: data,
                    allowEdit: canEdit,
                    description: (data['description'] ?? '').toString(),
                  ),
                  FinanceTab(profileId: widget.projectDocId),
                  ConnectTab(projectCode: (data['projectId'] ?? '').toString()),
                  UsersTab(projectData: data, profileId: widget.projectDocId),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
 
