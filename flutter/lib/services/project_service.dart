import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ProjectService {
  ProjectService._();
  static final instance = ProjectService._();

  final _db = FirebaseFirestore.instance;

  // Generate a short, human-friendly project code like P-7G9K4RX (7 chars)
  Future<String> generateUniqueProjectCode({int attempts = 10}) async {
    for (int i = 0; i < attempts; i++) {
      final code = _generateCode();
      final snap = await _db
          .collection('projects')
          .where('projectId', isEqualTo: code)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return code;
    }
    throw Exception('Could not generate a unique project code. Please try again.');
  }

  String _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rnd = Random.secure();
    String body = List.generate(7, (_) => chars[rnd.nextInt(chars.length)]).join();
    return 'P-$body';
  }

  // Create project with flexible context
  // contextType: 'personal' | 'individual' | 'organization'
  // For individual/org, provide their dbId and code where available. If linking later for individual, set linkLater=true.
  Future<DocumentReference<Map<String, dynamic>>> createProject({
    required String name,
    String? description,
    String? coverPhotoUrl,
    required String contextType,
    String? organizationDbId,
    String? organizationId,
    String? individualDbId,
    String? individualId,
    bool linkLater = false,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');

    final code = await generateUniqueProjectCode();

    return _db.runTransaction((tx) async {
      final projectsCol = _db.collection('projects');
      final newRef = projectsCol.doc();

  final now = FieldValue.serverTimestamp();
  final nowMs = DateTime.now().millisecondsSinceEpoch; // avoid sentinel inside arrays

      Map<String, dynamic> context = {'type': contextType};
      Map<String, dynamic> owner = {};
      final users = <Map<String, dynamic>>[];
      final teamUids = <String>{};

      if (contextType == 'organization') {
        if (organizationDbId == null || organizationId == null) {
          throw Exception('Organization not selected');
        }
        context['organizationDbId'] = organizationDbId;
        context['organizationId'] = organizationId;
        owner = { 'type': 'organization', 'organizationDbId': organizationDbId };
        users.add({ 'uid': user.uid, 'role': 'Admin', 'addedAt': nowMs });
        teamUids.add(user.uid);
      } else if (contextType == 'individual') {
        if (linkLater) {
          // Donor-led for now, pending link to an individual using the project code
          context = { 'type': 'personal' };
          owner = { 'type': 'user', 'uid': user.uid };
          users.add({ 'uid': user.uid, 'role': 'Owner', 'addedAt': nowMs });
          teamUids.add(user.uid);
        } else {
          if (individualDbId == null || individualId == null) {
            throw Exception('Individual not selected');
          }
          context['individualDbId'] = individualDbId;
          context['individualId'] = individualId;
          owner = { 'type': 'individual', 'individualDbId': individualDbId };
          users.add({ 'uid': user.uid, 'role': 'Admin', 'addedAt': nowMs });
          teamUids.add(user.uid);
          // Attempt to add the individual's owner uid if known
          final indSnap = await tx.get(_db.collection('individuals').doc(individualDbId));
          if (indSnap.exists) {
            final data = indSnap.data();
            final indOwner = (data?['ownerUid'] ?? '').toString();
            if (indOwner.isNotEmpty) {
              users.add({ 'uid': indOwner, 'role': 'Owner', 'addedAt': nowMs });
              teamUids.add(indOwner);
            }
          }
        }
      } else {
        // personal
        owner = { 'type': 'user', 'uid': user.uid };
        users.add({ 'uid': user.uid, 'role': 'Owner', 'addedAt': nowMs });
        teamUids.add(user.uid);
      }

      final payload = <String, dynamic>{
        'id': newRef.id,
        'name': name,
        'description': description ?? '',
        'coverPhotoUrl': coverPhotoUrl ?? '',
        'projectId': code,
        'createdAt': now,
        'updatedAt': now,
        'createdBy': user.uid,
        'context': context,
        'owner': owner,
        'users': users,
        'teamUids': teamUids.toList(),
        'visibility': 'private',
      };

      // Top-level organizationId for convenience queries (used by updates tab fallback)
      if (contextType == 'organization' && organizationId != null) {
        payload['organizationId'] = organizationId;
      }

      // Mark pending link request if linking to individual later
      if (contextType == 'individual' && linkLater) {
        payload['linkRequest'] = {
          'type': 'individual',
          'pending': true,
          'code': code,
          'invitedByUid': user.uid,
          'createdAt': now,
        };
        payload['requiresAcceptanceForLink'] = true;
      }

      tx.set(newRef, payload);
      return newRef;
    });
  }

  // Link an existing project by its projectId code to an individual's profile
  Future<void> linkProjectToIndividualByCode({
    required String projectCode,
    String? individualDbId,
    String? individualId,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');

    final q = await _db.collection('projects').where('projectId', isEqualTo: projectCode).limit(1).get();
    if (q.docs.isEmpty) throw Exception('Project not found for code');

    final ref = q.docs.first.reference;

    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) throw Exception('Project not found');
      final data = snap.data() as Map<String, dynamic>;

      final users = (data['users'] is List) ? List<Map<String, dynamic>>.from(data['users']) : <Map<String, dynamic>>[];
      final teamUids = (data['teamUids'] is List) ? Set<String>.from(data['teamUids']) : <String>{};

      // Ensure current user added
      if (!teamUids.contains(user.uid)) {
        users.add({ 'uid': user.uid, 'role': 'Owner', 'addedAt': DateTime.now().millisecondsSinceEpoch });
        teamUids.add(user.uid);
      }

      final updates = <String, dynamic>{
        'users': users,
        'teamUids': teamUids.toList(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // If we have an individual profile, link the project to that individual.
      // Otherwise, just add the current user to the project without changing context/owner.
      if ((individualDbId != null && individualDbId.isNotEmpty) &&
          (individualId != null && individualId.isNotEmpty)) {
        updates.addAll({
          'context': {
            'type': 'individual',
            'individualDbId': individualDbId,
            'individualId': individualId,
          },
          'owner': { 'type': 'individual', 'individualDbId': individualDbId },
          'requiresAcceptanceForLink': false,
          'linkRequest': FieldValue.delete(),
        });
      }

      tx.update(ref, updates);
    });
  }

  // Link an existing project by its projectId code to an organization context
  Future<void> linkProjectToOrganizationByCode({
    required String projectCode,
    required String organizationDbId,
    required String organizationId,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');

    final q = await _db.collection('projects').where('projectId', isEqualTo: projectCode).limit(1).get();
    if (q.docs.isEmpty) throw Exception('Project not found for code');

    final ref = q.docs.first.reference;

    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) throw Exception('Project not found');
      final data = snap.data() as Map<String, dynamic>;

      final users = (data['users'] is List) ? List<Map<String, dynamic>>.from(data['users']) : <Map<String, dynamic>>[];
      final teamUids = (data['teamUids'] is List) ? Set<String>.from(data['teamUids']) : <String>{};
      if (!teamUids.contains(user.uid)) {
        users.add({ 'uid': user.uid, 'role': 'Admin', 'addedAt': DateTime.now().millisecondsSinceEpoch });
        teamUids.add(user.uid);
      }

      tx.update(ref, {
        'context': { 'type': 'organization', 'organizationDbId': organizationDbId, 'organizationId': organizationId },
        'owner': { 'type': 'organization', 'organizationDbId': organizationDbId },
        'organizationId': organizationId,
        'users': users,
        'teamUids': teamUids.toList(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }
}
 
