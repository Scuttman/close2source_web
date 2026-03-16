import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';
import '../../widgets/organization_cover_image.dart';
import '../../services/image_cache_service.dart';
import '../updates_tab.dart';
import '../projects/finance_tab.dart';
import '../../services/project_service.dart';
import '../projects/create_project_screen.dart';
import '../projects/project_profile_screen.dart';

class OrganizationProfileScreen extends StatefulWidget {
  final String orgDocId;
  const OrganizationProfileScreen({super.key, required this.orgDocId});

  @override
  State<OrganizationProfileScreen> createState() => _OrganizationProfileScreenState();
}

class _OrganizationProfileScreenState extends State<OrganizationProfileScreen> {
  int _coverVersion = 0;
  int _logoVersion = 0;
  bool _picking = false;

  @override
  void initState() {
    super.initState();
    ImageCacheService.I.syncPending();
  }

  Future<File> _compressMaxWidth(File input, int maxWidth) async {
    final dir = await getTemporaryDirectory();
    final outPath = '${dir.path}/org_cover_${DateTime.now().millisecondsSinceEpoch}.jpg';
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
      await ImageCacheService.I.setOrgLocalCover(widget.orgDocId, compressed.path);
      await ImageCacheService.I.queueOrgCoverUpload(file: compressed, orgDocId: widget.orgDocId);
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

  Future<void> _pickNewLogo() async {
    if (_picking) return;
    _picking = true;
    try {
      final action = await showModalBottomSheet<String>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Wrap(children: [
            ListTile(leading: const Icon(Icons.photo), title: const Text('Choose logo from gallery'), onTap: () => Navigator.pop(ctx, 'gallery')),
            ListTile(leading: const Icon(Icons.photo_camera), title: const Text('Take a photo'), onTap: () => Navigator.pop(ctx, 'camera')),
            const SizedBox(height: 4),
          ]),
        ),
      );
      if (action == null) return;
      final picker = ImagePicker();
      final XFile? x = await picker.pickImage(source: action == 'camera' ? ImageSource.camera : ImageSource.gallery, maxWidth: 1000);
      if (x == null) return;
      final compressed = await _compressMaxWidth(File(x.path), 300);
      await ImageCacheService.I.setOrgLocalLogo(widget.orgDocId, compressed.path);
      await ImageCacheService.I.queueOrgLogoUpload(file: compressed, orgDocId: widget.orgDocId);
      setState(() => _logoVersion++);
      ImageCacheService.I.syncPending();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updating logo…')));
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
      stream: FirebaseFirestore.instance.collection('organizations').doc(widget.orgDocId).snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final data = snap.data!.data() ?? {};
        final name = (data['name'] ?? 'Organization').toString();
        final cover = (data['coverPhotoUrl'] ?? '').toString();
  final canEdit = _canEdit(data);
  final logo = (data['logoUrl'] ?? '').toString();

        return DefaultTabController(
          length: 4,
          child: Scaffold(
            body: NestedScrollView(
              headerSliverBuilder: (context, inner) => [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 220,
                  title: null,
                  bottom: const PreferredSize(
                    preferredSize: Size.fromHeight(48),
                    child: TabBar(
                      tabs: [
                        Tab(text: 'Overview'),
                        Tab(text: 'Updates'),
                        Tab(text: 'Projects'),
                        Tab(text: 'Finance'),
                      ],
                    ),
                  ),
                  flexibleSpace: FlexibleSpaceBar(
                    background: Stack(
                      fit: StackFit.expand,
                      children: [
                        OrganizationCoverImage(
                          key: ValueKey('cover-${widget.orgDocId}-v$_coverVersion'),
                          orgDocId: widget.orgDocId,
                          coverUrl: cover,
                          width: double.infinity,
                          height: double.infinity,
                          borderRadius: BorderRadius.zero,
                          fallback: Container(color: Colors.black12, child: const Center(child: Icon(Icons.photo, size: 48, color: Colors.white24))),
                          fit: BoxFit.cover,
                        ),
                        Container(color: Colors.black.withValues(alpha: 0.25)),
                        // Centered circular logo overlay
                        Positioned(
                          left: 16,
                          bottom: 72,
                          child: _OrgLogoCircle(
                            orgDocId: widget.orgDocId,
                            logoUrl: logo,
                            version: _logoVersion,
                            canEdit: canEdit,
                            onTapEdit: _pickNewLogo,
                          ),
                        ),
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: 24,
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
                  _OrgOverviewTab(data: data),
                  UpdatesTab(
                    orgId: widget.orgDocId,
                    orgCode: (data['orgId'] ?? '').toString(),
                    orgData: data,
                    allowEdit: canEdit,
                  ),
                  OrgProjectsTab(
                    orgDocId: widget.orgDocId,
                    orgCode: (data['orgId'] ?? '').toString(),
                    canEdit: canEdit,
                  ),
                  FinanceTab(profileId: widget.orgDocId),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class OrgProjectsTab extends StatelessWidget {
  final String orgDocId;
  final String orgCode;
  final bool canEdit;
  const OrgProjectsTab({super.key, required this.orgDocId, required this.orgCode, required this.canEdit});

  @override
  Widget build(BuildContext context) {
    final q = FirebaseFirestore.instance.collection('projects').where('organizationId', isEqualTo: orgCode).orderBy('createdAt', descending: true);
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: q.snapshots(),
      builder: (context, snap) {
        final docs = snap.data?.docs ?? const <QueryDocumentSnapshot<Map<String, dynamic>>>[];
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Projects', style: Theme.of(context).textTheme.titleMedium),
                  ),
                  if (canEdit) ...[
                    IconButton(
                      tooltip: 'Link by code',
                      icon: const Icon(Icons.qr_code_2),
                      onPressed: () async {
                        final code = await _promptForCode(context);
                        if (code == null) return;
                        try {
                          await ProjectService.instance.linkProjectToOrganizationByCode(projectCode: code, organizationDbId: orgDocId, organizationId: orgCode);
                          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Project linked to organization')));
                        } catch (e) {
                          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
                        }
                      },
                    ),
                    const SizedBox(width: 4),
                    Tooltip(
                      message: 'Create new project',
                      child: IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () async {
                          final ok = await Navigator.of(context).push<bool>(
                            MaterialPageRoute(
                              builder: (_) => CreateProjectScreen.prefilledForOrganization(
                                orgDbId: orgDocId,
                                orgCode: orgCode,
                              ),
                            ),
                          );
                          if (ok == true && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Project created')));
                          }
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.separated(
                itemCount: docs.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final d = docs[i];
                  final data = d.data();
                  final name = (data['name'] ?? 'Untitled').toString();
                  final code = (data['projectId'] ?? d.id).toString();
                  // final desc = (data['description'] ?? '').toString();
                  return ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.folder)),
                    title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(code, style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProjectProfileScreen(projectDocId: d.id)));
                    },
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Future<String?> _promptForCode(BuildContext context) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Link project by code'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(hintText: 'Enter project code, e.g. P-7G9K4RX'),
          textCapitalization: TextCapitalization.characters,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim().toUpperCase()), child: const Text('Link')),
        ],
      ),
    );
  }
}

class _OrgOverviewTab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _OrgOverviewTab({required this.data});
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Overview', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        if (data['bio'] != null) Text(data['bio'] ?? ''),
      ],
    );
  }
}

class _OrgLogoCircle extends StatefulWidget {
  final String orgDocId;
  final String logoUrl;
  final int version; // to bust local state on updates
  final bool canEdit;
  final VoidCallback onTapEdit;
  const _OrgLogoCircle({required this.orgDocId, required this.logoUrl, required this.version, required this.canEdit, required this.onTapEdit});
  @override
  State<_OrgLogoCircle> createState() => _OrgLogoCircleState();
}

class _OrgLogoCircleState extends State<_OrgLogoCircle> {
  String? _local;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _OrgLogoCircle oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.version != widget.version || oldWidget.logoUrl != widget.logoUrl || oldWidget.orgDocId != widget.orgDocId) {
      _local = null;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final p = ImageCacheService.I.getOrgLocalLogoSync(widget.orgDocId);
      if (p != null && mounted) { setState(() => _local = p); return; }
    } catch (_) {}
    if (widget.logoUrl.isNotEmpty) {
      try {
        final local = await ImageCacheService.I.getLocalForRemote(widget.logoUrl);
        if (local != null) {
          await ImageCacheService.I.setOrgLocalLogo(widget.orgDocId, local);
          if (mounted) setState(() => _local = local);
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
  const double size = 72.0;
  const border = Border.fromBorderSide(BorderSide(color: Colors.white, width: 2));
    Widget avatar;
    if (_local != null && File(_local!).existsSync()) {
      avatar = ClipOval(child: Image.file(File(_local!), width: size, height: size, fit: BoxFit.cover));
    } else if (widget.logoUrl.isNotEmpty) {
      avatar = ClipOval(child: Image.network(widget.logoUrl, width: size, height: size, fit: BoxFit.cover));
    } else {
      avatar = const CircleAvatar(radius: size/2, child: Icon(Icons.apartment));
    }
    return GestureDetector(
      onTap: widget.canEdit ? widget.onTapEdit : null,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              border: border,
              boxShadow: [BoxShadow(color: Colors.black38, blurRadius: 8, offset: Offset(0, 3))],
            ),
            child: avatar,
          ),
          if (widget.canEdit)
            Positioned(
              right: -2,
              bottom: -2,
              child: Container(
                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), shape: BoxShape.circle),
                child: const Padding(
                  padding: EdgeInsets.all(4.0),
                  child: Icon(Icons.edit, size: 14, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
