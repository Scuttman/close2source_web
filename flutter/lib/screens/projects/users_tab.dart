import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../services/project_finance_service.dart';

class UsersTab extends StatelessWidget {
  final Map<String, dynamic> projectData;
  final String profileId; // use projectDocId as profileId
  const UsersTab({super.key, required this.projectData, required this.profileId});

  @override
  Widget build(BuildContext context) {
  final owner = (projectData['owner'] is Map)
        ? Map<String, dynamic>.from(projectData['owner'])
        : <String, dynamic>{};
    final String? ownerUid = (owner['type'] == 'user') ? (owner['uid']?.toString()) : null;
    final teamUids = (projectData['teamUids'] is List)
        ? List<String>.from(projectData['teamUids'])
        : const <String>[];

  // Ensure members subcollection has owner/team entries with denormalized fields
  // Only allow seeding if current user can manage (Owner or Admin on project)
  final currentUid = FirebaseAuth.instance.currentUser?.uid;
  bool canSeed = false;
  if (currentUid != null) {
    if (ownerUid != null && ownerUid == currentUid) {
      canSeed = true;
    } else {
      final usersArr = (projectData['users'] is List)
          ? List<Map<String, dynamic>>.from(projectData['users'])
          : const <Map<String, dynamic>>[];
      for (final m in usersArr) {
        try {
          if (m['uid'] == currentUid) {
            final role = (m['role'] ?? '').toString();
            if (role == 'Owner' || role == 'Admin') { canSeed = true; break; }
          }
        } catch (_) {}
      }
    }
  }
  if (canSeed) {
    _ensureMembersSeeded(profileId: profileId, ownerUid: ownerUid, teamUids: teamUids);
  }

  // Roles are merged from Firestore members subcollection below

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('profiles')
          .doc(profileId)
          .collection('members')
          .snapshots(),
      builder: (context, snap) {
        final rolesByUid = <String, List<String>>{};
        final memberDocsByUid = <String, Map<String, dynamic>>{};
        if (snap.hasData) {
          for (final d in snap.data!.docs) {
            final data = d.data();
            final roles = (data['roles'] is List)
                ? List<String>.from(data['roles'])
                : const <String>[];
            rolesByUid[d.id] = roles;
            memberDocsByUid[d.id] = data;
          }
        }

        // Merge owner and team with member roles
        final ordered = <_UserListItem>[];
        if (ownerUid != null && ownerUid.isNotEmpty) {
          ordered.add(_UserListItem(uid: ownerUid, roles: const ['Owner']));
        }
        // Add team members after owner
        for (final uid in teamUids) {
          if (uid.isEmpty) continue;
          if (ownerUid != null && uid == ownerUid) continue;
          final r = rolesByUid[uid];
          ordered.add(_UserListItem(uid: uid, roles: (r == null || r.isEmpty) ? const ['User'] : r));
        }

        // Add any additional members not in teamUids/owner
        for (final uid in rolesByUid.keys) {
          if (uid == ownerUid) continue;
          if (teamUids.contains(uid)) continue;
          final r = rolesByUid[uid];
          ordered.add(_UserListItem(uid: uid, roles: (r == null || r.isEmpty) ? const ['User'] : r));
        }

  const canManage = true; // Actual permission can be computed with roles if needed

        return ListView.separated(
          itemBuilder: (context, index) {
            final it = ordered[index];
            final m = memberDocsByUid[it.uid] ?? const <String, dynamic>{};
            String display = (m['displayName'] ?? '').toString().trim();
            if (display.isEmpty) {
              final name = (m['name'] ?? '').toString().trim();
              final surname = (m['surname'] ?? '').toString().trim();
              final combined = [name, surname].where((p) => p.isNotEmpty).join(' ');
              if (combined.isNotEmpty) display = combined;
            }
            String photoUrl = (m['photoURL'] ?? '').toString().trim();

            Widget buildTile(String titleText, String? photo, {bool ownerRow = false}) {
              String initialsSource = titleText.isNotEmpty ? titleText : it.uid;
              String initials = initialsSource.trim();
              if (initials.contains('@')) {
                initials = initials.split('@').first;
              }
              if (initials.contains(' ')) {
                final parts = initials.split(RegExp(r"\s+")).where((e) => e.isNotEmpty).toList();
                initials = parts.take(2).map((e) => e.substring(0, 1)).join();
              } else {
                initials = initials.substring(0, 1);
              }
              initials = initials.toUpperCase();
              ImageProvider? avatarImage;
              if ((photo ?? '').isNotEmpty) {
                avatarImage = NetworkImage(photo!);
              }
              final isOwnerRow = ownerUid != null && it.uid == ownerUid;
              return ListTile(
                leading: CircleAvatar(
                  backgroundImage: avatarImage,
                  child: avatarImage == null ? Text(initials) : null,
                ),
                title: Text(titleText.isNotEmpty ? titleText : it.uid),
                subtitle: Text(it.roles.join(', ')),
                trailing: (canManage && !isOwnerRow)
                    ? IconButton(
                        icon: const Icon(Icons.manage_accounts),
                        tooltip: 'Manage roles',
                        onPressed: () async {
                          await _openRoleEditor(context: context, uid: it.uid, currentRoles: it.roles);
                        },
                      )
                    : null,
              );
            }

            // If we already have display or photo from members, use it directly
            if (display.isNotEmpty || photoUrl.isNotEmpty) {
              return buildTile(display.isNotEmpty ? display : (m['email'] ?? '').toString().trim(), photoUrl);
            }

            // Fallback: fetch user profile live and show name/photo without waiting for seeding
            return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              future: FirebaseFirestore.instance.collection('users').doc(it.uid).get(),
              builder: (ctx, userSnap) {
                String d = display;
                String p = photoUrl;
                if (userSnap.hasData && userSnap.data!.exists) {
                  final ud = userSnap.data!.data();
                  if (ud != null) {
                    final name = (ud['name'] ?? '').toString().trim();
                    final surname = (ud['surname'] ?? '').toString().trim();
                    final combined = [name, surname].where((e) => e.isNotEmpty).join(' ');
                    final disp = (ud['displayName'] ?? '').toString().trim();
                    d = combined.isNotEmpty ? combined : (disp.isNotEmpty ? disp : (ud['email'] ?? '').toString().trim());
                    final pu = (ud['photoURL'] ?? '').toString().trim();
                    if (pu.isNotEmpty) p = pu;
                  }
                }
                return buildTile(d.isNotEmpty ? d : it.uid, p);
              },
            );
          },
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemCount: ordered.length,
        );
      },
    );
  }

  Future<void> _ensureMembersSeeded({required String profileId, String? ownerUid, required List<String> teamUids}) async {
    try {
      final db = FirebaseFirestore.instance;
      final membersCol = db.collection('profiles').doc(profileId).collection('members');
      final toEnsure = <String>{};
      if (ownerUid != null && ownerUid.isNotEmpty) toEnsure.add(ownerUid);
      for (final u in teamUids) {
        if (u.isNotEmpty) toEnsure.add(u);
      }
      if (toEnsure.isEmpty) return;
      for (final uid in toEnsure) {
        final ref = membersCol.doc(uid);
        final snap = await ref.get();
        // If member doc missing key fields, merge from users/{uid}
        final current = snap.data() ?? const <String, dynamic>{};
        final hasNameLike = ((current['displayName'] ?? '').toString().trim().isNotEmpty) ||
            ((current['name'] ?? '').toString().trim().isNotEmpty) ||
            ((current['surname'] ?? '').toString().trim().isNotEmpty);
        final hasPhoto = (current['photoURL'] ?? '').toString().trim().isNotEmpty;

        if (!snap.exists || !hasNameLike || !hasPhoto) {
          // Fetch basic user profile to denormalize
          String? name; String? surname; String? displayName; String? email; String? photoURL;
          try {
            final u = await db.collection('users').doc(uid).get();
            if (u.exists) {
              final d = u.data();
              if (d != null) {
                name = (d['name'] ?? '').toString().trim();
                surname = (d['surname'] ?? '').toString().trim();
                displayName = (d['displayName'] ?? '').toString().trim();
                email = (d['email'] ?? '').toString().trim();
                final p = (d['photoURL'] ?? '').toString().trim();
                if (p.isNotEmpty) photoURL = p;
              }
            }
          } catch (_) {}
          String? full;
          final parts = <String>[if ((name ?? '').isNotEmpty) name!, if ((surname ?? '').isNotEmpty) surname!];
          if (parts.isNotEmpty) {
            full = parts.join(' ');
          } else if ((displayName ?? '').isNotEmpty) {
            full = displayName;
          }
          final payload = <String, dynamic>{
            if (!hasNameLike) ...{
              if (full != null && full.isNotEmpty) 'displayName': full,
              if ((name ?? '').isNotEmpty) 'name': name,
              if ((surname ?? '').isNotEmpty) 'surname': surname,
            },
            if ((email ?? '').isNotEmpty) 'email': email,
            if (!hasPhoto && (photoURL ?? '').isNotEmpty) 'photoURL': photoURL,
            if (!snap.exists) ...{
              'roles': ['User'],
              'createdAt': FieldValue.serverTimestamp(),
            },
          };
          if (payload.isNotEmpty) {
            await ref.set(payload, SetOptions(merge: true));
          }
        }
      }
    } catch (_) {
      // Non-fatal; UI will still render available members
    }
  }

  Future<void> _openRoleEditor({
    required BuildContext context,
    required String uid,
    required List<String> currentRoles,
  }) async {
    const roleOptions = <String>['Admin','Editor','Finance','Reporting','User'];
    final selected = currentRoles.where(roleOptions.contains).toSet();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: StatefulBuilder(
              builder: (ctx2, setState2) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Set roles for $uid', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final r in roleOptions)
                          FilterChip(
                            label: Text(r),
                            selected: selected.contains(r),
                            onSelected: (on) {
                              setState2(() {
                                if (on) {
                                  selected.add(r);
                                } else {
                                  selected.remove(r);
                                }
                              });
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                        const Spacer(),
                        FilledButton(
                          onPressed: () async {
                            final roles = selected.isEmpty ? <String>['User'] : selected.toList();
                            try {
                              await ProjectFinanceService.instance.setProfileMemberRoles(
                                profileId: profileId,
                                memberUid: uid,
                                roles: roles,
                              );
                              // ignore: use_build_context_synchronously
                              Navigator.pop(ctx);
                            } catch (e) {
                              // ignore: use_build_context_synchronously
                              ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed to update: $e')));
                            }
                          },
                          child: const Text('Save'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class _UserListItem {
  final String uid;
  final List<String> roles;
  _UserListItem({required this.uid, required this.roles});
}
