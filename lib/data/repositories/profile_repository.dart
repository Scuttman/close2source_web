import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/profile.dart';
import '../models/spending_entry.dart';

class ProfileRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  ProfileRepository() {
    _firestore.settings = const Settings(persistenceEnabled: true);
  }

  /// Get a stream of all profiles the user has access to.
  Stream<List<Profile>> getProfilesForUser(String uid) {
    return _firestore
        .collection('Profiles')
        .where('profileUsersIds', arrayContains: uid)
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) => Profile.fromFirestore(doc)).toList());
  }

  Future<List<Profile>> getProfilesForCurrentUser() async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return [];

    try {
      final querySnapshot = await _firestore
          .collection('Profiles')
          .where('profileUsersIds', arrayContains: uid)
          .get(const GetOptions(source: Source.cache)); // Try offline first

      // If cache returns nothing, try server
      if (querySnapshot.docs.isEmpty) {
        final serverSnapshot = await _firestore
            .collection('Profiles')
            .where('profileUsersIds', arrayContains: uid)
            .get(const GetOptions(source: Source.serverAndCache));
        return serverSnapshot.docs.map((doc) => Profile.fromFirestore(doc)).toList();
      }

      return querySnapshot.docs.map((doc) => Profile.fromFirestore(doc)).toList();
    } catch (e) {
      print('❌ Error fetching profiles: $e');
      return [];
    }
  }

  Future<List<Profile>> forceRefreshProfilesForCurrentUser() async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return [];

    try {
      // Get server-side list
      final serverSnapshot = await _firestore
          .collection('Profiles')
          .where('profileUsersIds', arrayContains: uid)
          .get(const GetOptions(source: Source.server));
      final serverDocs = serverSnapshot.docs;
      final serverProfiles = _deduplicate(serverDocs);
      final serverIds = serverProfiles.map((p) => p.profileId).toSet();

      // Get local cache list
      final cacheSnapshot = await _firestore
          .collection('Profiles')
          .where('profileUsersIds', arrayContains: uid)
          .get(const GetOptions(source: Source.cache));
      final cacheDocs = cacheSnapshot.docs;
      final cacheIds = cacheDocs.map((doc) => doc.id).toSet();

      // Sync fresh profiles back into the cache
      for (var profile in serverProfiles) {
        await _firestore
            .collection('Profiles')
            .doc(profile.profileId)
            .set(profile.toJson(), SetOptions(merge: true));
      }

      // Remove deleted profiles from the cache
      final removedFromServer = cacheIds.difference(serverIds);
      for (var profileId in removedFromServer) {
        await _firestore.collection('Profiles').doc(profileId).delete();
      }

      return serverProfiles;
    } catch (e) {
      print('❌ Error syncing profiles: $e');
      return [];
    }
  }

  List<Profile> _deduplicate(List<QueryDocumentSnapshot> docs) {
    final seen = <String>{};
    final unique = <Profile>[];

    for (var doc in docs) {
      final data = doc.data() as Map<String, dynamic>;
      final id = data['profileId'] ?? doc.id;
      if (!seen.contains(id)) {
        seen.add(id);
        unique.add(Profile.fromFirestore(doc));
      }
    }

    return unique;
  }

  /// Get a single profile by its code.
  Future<Profile?> getProfileByCode(String code) async {
    final query = await _firestore
        .collection('Profiles')
        .where('profileCode', isEqualTo: code)
        .limit(1)
        .get();

    if (query.docs.isEmpty) return null;
    return Profile.fromFirestore(query.docs.first);
  }

  /// Create or update a profile
  Future<void> saveProfile(Profile profile) async {
    await _firestore.collection('Profiles').doc(profile.profileId).set(profile.toJson());
  }

  /// Delete a profile by its ID
  Future<void> deleteProfile(String profileId) async {
    await _firestore.collection('Profiles').doc(profileId).delete();
  }

  /// Create a demo profile for current user
  Future<void> createDemoProfile({
    required String uid,
    required String email,
  }) async {
    final now = Timestamp.now();
    final demoProfile = Profile(
      profileId: _firestore.collection('Profiles').doc().id,
      profileCode: 'PYWELVO',
      profileName: 'The Piggery Project',
      profileDesc: 'The Dogo family have been farming for a number of years in Malawi and using the proceeds to support their work as YWAM Missionaries. Robert leads on sustainable missions and is active in drilling boreholes for communities around the country.\n\nThe piggery project will help the Dogo family expand their impact as they scale their small animal smallholding into a farm that can cope with 500 pigs at once. This projects will create a greater income stream and be an example for others to follow. The farm also provides employment for local workers.',
      profileOwner: uid,
      profileSponsor: 'Sustainable Missions',
      profileBudget: 0.0,
      profileBalance: '0',
      profileCurrency: 'MWK',
      profileStartDate: now,
      creationDate: now,
      lastUpdated: now,
      createdBy: uid,
      expiryDate: Timestamp.fromDate(DateTime.now().add(Duration(days: 365 * 5))),
      status: 'active',
      profileType: 'Project',
      reportList: [],
      transactionList: [],
      photoList: [],
      profileUsersIds: [uid],
      profileUsers: [
        {
          'uid': uid,
          'email': email,
          'role': 'owner',
        },
      ],
    );

    await saveProfile(demoProfile);
  }

  Future<void> addTransactionToProfile({
    required String profileId,
    required SpendingEntry transaction,
  }) async {
    try {
      final docRef = _firestore.collection('Profiles').doc(profileId);

      await docRef.update({
        'transactionList': FieldValue.arrayUnion([transaction.toJson()]),
        'lastUpdated': FieldValue.serverTimestamp(),
      });

      print('✅ Transaction added to profile $profileId');
    } catch (e) {
      print('❌ Error adding transaction to profile: $e');
      rethrow;
    }
  }
}
