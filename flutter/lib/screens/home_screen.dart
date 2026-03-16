import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:rxdart/rxdart.dart';
import 'updates_tab.dart';
import '../theme/branding.dart';
import 'auth_gate.dart';
import 'projects/project_profile_screen.dart';
import 'organizations/org_profile_screen.dart';
import 'organizations/create_organization_screen.dart';
import '../widgets/project_cover_image.dart';
import 'qr_scanner_screen.dart';
import 'projects/create_project_screen.dart';

class HomeScreen extends StatelessWidget {
  final User user;
  const HomeScreen({super.key, required this.user});

  // Combines two queries (owner + indexed membership) client-side.
  Stream<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _membershipDocs() {
    final orgs = FirebaseFirestore.instance.collection('organizations');
    final ownerStream = orgs.where('ownerUid', isEqualTo: user.uid).limit(50).snapshots();
    // teamUids array created by cloud function onOrganizationWrite
    final memberStream = orgs.where('teamUids', arrayContains: user.uid).limit(50).snapshots();
    return Rx.combineLatest2<
        QuerySnapshot<Map<String, dynamic>>,
        QuerySnapshot<Map<String, dynamic>>,
        List<QueryDocumentSnapshot<Map<String, dynamic>>>>(ownerStream, memberStream, (a, b) {
      final map = <String, QueryDocumentSnapshot<Map<String, dynamic>>>{};
      for (final d in a.docs) { map[d.id] = d; }
      for (final d in b.docs) { map[d.id] = d; }
      return map.values.toList();
    }).map((list) {
      list.sort((x, y) => (y.data()['updatedAt'] ?? '').compareTo(x.data()['updatedAt'] ?? '')); // simple ordering
      return list;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image reused from login
          Image.asset(
            'assets/images/sitebg.jpg',
            fit: BoxFit.cover,
            alignment: Alignment.center,
            color: Colors.black.withValues(alpha: 0.35),
            colorBlendMode: BlendMode.darken,
          ),
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xAA000000), Color(0x33000000)],
              ),
            ),
          ),
          SafeArea(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                    child: _UserHeader(user: user),
                  ),
                ),
                // Role-based home section
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: _RoleHomeSwitcher(user: user),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('Organizations', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                        ),
                        Tooltip(
                          message: 'Add organization (scan or code)',
                          child: IconButton(
                            icon: const Icon(Icons.qr_code_scanner),
                            onPressed: () async {
                              final res = await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const QrScannerScreen()),
                              );
                              if (res == true && context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Organization linked')),
                                );
                              }
                            },
                          ),
                        ),
                        Tooltip(
                          message: 'Create new organization',
                          child: IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () async {
                              final res = await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const CreateOrganizationScreen()),
                              );
                              if (res == true && context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Organization created')),
                                );
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                StreamBuilder<List<QueryDocumentSnapshot<Map<String, dynamic>>>>(
                  stream: _membershipDocs(),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const SliverFillRemaining(
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    if (snap.hasError) {
                      return SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Text('Error: ${snap.error}', style: const TextStyle(color: Colors.red)),
                        ),
                      );
                    }
                    final docs = snap.data ?? [];
                    if (docs.isEmpty) {
                      return const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Text('No organizations yet.'),
                        ),
                      );
                    }
                    return SliverList.separated(
                      itemCount: docs.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final data = docs[i].data();
                        final role = _deriveRole(data);
                        return _OrgCard(
                          name: data['name'] ?? '(Unnamed)',
                          code: data['orgId'] ?? docs[i].id,
                          role: role,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => OrganizationProfileScreen(orgDocId: docs[i].id),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 40)),
              ],
            ),
          ),
          // Logout button floating top right (placed last to ensure it's on top and receives taps)
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 8, right: 8),
                child: Material(
                  color: Colors.white.withValues(alpha: 0.08),
                  shape: const CircleBorder(),
                  child: IconButton(
                    tooltip: 'Sign out',
                    onPressed: () async {
                      await FirebaseAuth.instance.signOut();
                      // Return to the AuthGate so the auth stream can drive the next screen
                      if (context.mounted) {
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const AuthGate()),
                          (route) => false,
                        );
                      }
                    },
                    icon: const Icon(Icons.logout, size: 20),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _deriveRole(Map<String, dynamic> org) {
    final team = (org['team'] is List) ? (org['team'] as List) : [];
    for (final m in team) {
      if (m is Map && (m['uid'] == FirebaseAuth.instance.currentUser?.uid)) {
        return (m['role'] ?? 'Member').toString();
      }
    }
    if (org['ownerUid'] == FirebaseAuth.instance.currentUser?.uid) return 'Owner';
    return 'Member';
  }
}

class _UserHeader extends StatelessWidget {
  final User user;
  const _UserHeader({required this.user});
  @override
  Widget build(BuildContext context) {
  String? photo; // prefer Firestore users.photoURL (set during onboarding), else FirebaseAuth user.photoURL
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots(),
      builder: (context, snap) {
        String? fullName;
        String? roleLabel;
        if (snap.hasData && snap.data!.exists) {
          final data = snap.data!.data();
          if (data != null) {
            final name = (data['name'] ?? '').toString().trim();
            final surname = (data['surname'] ?? '').toString().trim();
            final combined = [name, surname].where((p) => p.isNotEmpty).join(' ');
            if (combined.isNotEmpty) fullName = combined;
            final p = (data['photoURL'] ?? '').toString();
            if (p.isNotEmpty) photo = p;
            final role = (data['role'] ?? '').toString();
            if (role.isNotEmpty) {
              roleLabel = role.substring(0,1).toUpperCase() + role.substring(1).toLowerCase();
            }
          }
        }
        photo ??= user.photoURL;
        final display = fullName ?? (user.displayName?.isNotEmpty == true ? user.displayName! : (user.email ?? 'User'));
        final initialSource = fullName?.isNotEmpty == true
            ? fullName!
            : (user.displayName?.isNotEmpty == true ? user.displayName! : (user.email ?? '?'));

        // Build avatar image provider safely for nullable photo
        ImageProvider? avatarImage;
        if (photo != null && photo!.isNotEmpty) {
          final p = photo!;
          if (p.startsWith('/') || p.startsWith('file://')) {
            final localPath = p.startsWith('file://') ? p.substring(7) : p;
            avatarImage = FileImage(File(localPath));
          } else {
            avatarImage = NetworkImage(p);
          }
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 34,
              backgroundColor: Branding.accent.withValues(alpha: 0.15),
              backgroundImage: avatarImage,
              child: avatarImage == null
                  ? Text(
                      initialSource.substring(0, 1).toUpperCase(),
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
                    )
                  : null,
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    display,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.5,
                        ) ?? const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(roleLabel ?? 'User', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _OrgCard extends StatelessWidget {
  final String name;
  final String code;
  final String role;
  final VoidCallback onTap;
  const _OrgCard({required this.name, required this.code, required this.role, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Ink(
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: Branding.accent,
                child: Text(name.substring(0, 1).toUpperCase()),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(code, style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 12)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Branding.accent.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(role, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.white.withValues(alpha: 0.8)),
            ],
          ),
        ),
      ),
    );
  }
}

class ProjectDetailScreen extends StatefulWidget {
  final String orgId;
  final Map<String, dynamic> orgData;
  const ProjectDetailScreen({super.key, required this.orgId, required this.orgData});

  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.orgData['name'] ?? 'Organization'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Updates'),
            Tab(text: 'Finances'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _OverviewTab(data: widget.orgData),
          UpdatesTab(
            orgId: widget.orgId, // Firestore organization document id
            orgCode: widget.orgData['orgId'] ?? widget.orgId, // human/org code used by projects.organizationId
            orgData: widget.orgData,
            allowEdit: true,
          ),
          _FinancesTab(orgId: widget.orgId),
        ],
      ),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _OverviewTab({required this.data});
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

// (Placeholder _UpdatesTab removed in favor of full UpdatesTab widget.)

class _FinancesTab extends StatelessWidget {
  final String orgId;
  const _FinancesTab({required this.orgId});
  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Finances (TODO)'));
  }
}

// Role-based home switcher and placeholder views
class _RoleHomeSwitcher extends StatelessWidget {
  final User user;
  const _RoleHomeSwitcher({required this.user});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots(),
      builder: (context, snap) {
        final role = (snap.data?.data()?['role'] ?? '').toString().toLowerCase();
        switch (role) {
          case 'donor':
            return const _DonorHomeView();
          case 'staff':
            return const _StaffHomeView();
          case 'individual':
            return const _IndividualHomeView();
          case 'business':
            return const _BusinessHomeView();
          default:
            return const _DefaultHomeView();
        }
      },
    );
  }
}

class _HomeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _HomeCard({required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
  color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(icon, color: Branding.accent, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.75))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DonorHomeView extends StatelessWidget {
  const _DonorHomeView();
  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _HomeCard(
          icon: Icons.favorite,
          title: 'Donor home',
          subtitle: 'Placeholder — tailored donor insights go here.',
        ),
        const SizedBox(height: 12),
        // Removed Create Project from Donor view per requirements
        const SizedBox(height: 12),
        if (user != null)
          _MyProjectsList(
            uid: user.uid,
            title: "Projects you're supporting/involved in",
            showScanAction: true,
          ),
      ],
    );
  }
}

class _StaffHomeView extends StatelessWidget {
  const _StaffHomeView();
  @override
  Widget build(BuildContext context) {
    return const _HomeCard(
      icon: Icons.badge,
      title: 'Staff home',
      subtitle: 'Placeholder — staff tools and tasks go here.',
    );
  }
}

class _IndividualHomeView extends StatelessWidget {
  const _IndividualHomeView();
  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _HomeCard(
          icon: Icons.person,
          title: 'Individual home',
          subtitle: 'Placeholder — individual dashboard content.',
        ),
        const SizedBox(height: 12),
        if (user != null)
          _MyProjectsList(
            uid: user.uid,
            title: "Projects you're involved in",
            showScanAction: true,
          ),
      ],
    );
  }
}

class _BusinessHomeView extends StatelessWidget {
  const _BusinessHomeView();
  @override
  Widget build(BuildContext context) {
    return const _HomeCard(
      icon: Icons.apartment,
      title: 'Business home',
      subtitle: 'Placeholder — business/partner overview.',
    );
  }
}

class _DefaultHomeView extends StatelessWidget {
  const _DefaultHomeView();
  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HomeCard(
          icon: Icons.home,
          title: 'Home',
          subtitle: 'Placeholder — role not set, showing default.',
        ),
        SizedBox(height: 12),
        // Removed Create Project from Default view per requirements
      ],
    );
  }
}

class _MyProjectsList extends StatelessWidget {
  final String uid;
  final String title;
  final bool showScanAction;
  const _MyProjectsList({required this.uid, required this.title, this.showScanAction = false});

  Stream<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _stream() {
    final col = FirebaseFirestore.instance.collection('projects');
    final s1 = col.where('teamUids', arrayContains: uid).limit(50).snapshots();
    final s2 = col.where('owner.uid', isEqualTo: uid).limit(50).snapshots();
    final s3 = col.where('createdBy', isEqualTo: uid).limit(50).snapshots();
    return Rx.combineLatest3<
        QuerySnapshot<Map<String, dynamic>>,
        QuerySnapshot<Map<String, dynamic>>,
        QuerySnapshot<Map<String, dynamic>>,
        List<QueryDocumentSnapshot<Map<String, dynamic>>>>(s1, s2, s3, (a, b, c) {
      final map = <String, QueryDocumentSnapshot<Map<String, dynamic>>>{};
      for (final d in a.docs) { map[d.id] = d; }
      for (final d in b.docs) { map[d.id] = d; }
      for (final d in c.docs) { map[d.id] = d; }
      final list = map.values.toList();
      list.sort((x, y) {
        int ts(dynamic v) {
          if (v == null) return 0;
          if (v is Timestamp) return v.millisecondsSinceEpoch;
          return 0;
        }
        final dx = x.data();
        final dy = y.data();
        return ts(dy['updatedAt']) - ts(dx['updatedAt']);
      });
      return list;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Expanded(
                child: Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
              ),
              if (showScanAction) ...[
                Tooltip(
                  message: 'Add project (scan or code)',
                  child: IconButton(
                    icon: const Icon(Icons.qr_code_scanner),
                    onPressed: () async {
                      final res = await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const QrScannerScreen()),
                      );
                      if (res == true && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Project linked')),
                        );
                      }
                    },
                  ),
                ),
                const SizedBox(width: 4),
                Tooltip(
                  message: 'Create new project',
                  child: IconButton(
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: () async {
                      final res = await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const CreateProjectScreen()),
                      );
                      if (res == true && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Project created')),
                        );
                      }
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
        StreamBuilder<List<QueryDocumentSnapshot<Map<String, dynamic>>>>(
          stream: _stream(),
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final docs = snap.data ?? const [];
            if (docs.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('No projects yet.', style: TextStyle(color: Colors.white.withValues(alpha: 0.8))),
              );
            }
            return Column(
              children: [
                for (final d in docs)
                  _ProjectListItem(docId: d.id, data: d.data()),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _ProjectListItem extends StatelessWidget {
  final Map<String, dynamic> data;
  final String docId;
  const _ProjectListItem({required this.data, required this.docId});
  @override
  Widget build(BuildContext context) {
    final name = (data['name'] ?? '(Unnamed)').toString();
    final code = (data['projectId'] ?? '').toString();
    final ctx = (data['context'] is Map) ? (data['context'] as Map) : const {};
    final type = (ctx['type'] ?? 'personal').toString();
    final cover = (data['coverPhotoUrl'] ?? '').toString();
    final initial = name.isNotEmpty ? name.substring(0,1).toUpperCase() : '?';
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProjectProfileScreen(projectDocId: docId)),
      ),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            ProjectCoverImage(
              projectDocId: docId,
              coverUrl: cover,
              width: 46,
              height: 46,
              borderRadius: BorderRadius.circular(8),
              fallback: CircleAvatar(
                radius: 16,
                backgroundColor: Branding.accent,
                child: Text(initial),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Row(children: [
                    if (code.isNotEmpty) Text(code, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Branding.accent.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(type, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
                    ),
                  ]),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.white.withValues(alpha: 0.8)),
          ],
        ),
      ),
    );
  }
}