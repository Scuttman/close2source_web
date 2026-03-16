import 'dart:async';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// ImageCacheService
/// Responsibilities:
/// 1. Cache remote image URLs (Firebase Storage) locally for offline display.
/// 2. Store mapping remoteUrl -> localPath + lastUpdated.
/// 3. Handle pending local images (picked for a new update) when offline:
///    - Save temp file with metadata (orgId/projectId + updateDraftId + order index).
///    - Background sync scans pending list, uploads to Storage, updates Firestore update doc/array atomically.
/// 4. Provide helper to transform update objects replacing remote URLs with local file paths if cached.
///
/// Storage:
///  hive box 'image_cache' => key remoteUrl -> { 'local': path, 'ts': epochMs }
///  hive box 'pending_uploads' => list of entries { 'id', 'file', 'orgId', 'projectDocId', 'type':'project'|'org', 'created': epochMs }
///
/// NOTE: For updates array in a project/org doc we can't safely mutate single update without race.
/// Strategy for offline upload reconciliation:
///  - While offline we add a placeholder local path entry to the update's images list (starting with 'local://<uuid>').
///  - On sync we upload each pending file and then run a transaction that:
///       * loads current updates array
///       * finds any image entries matching placeholder token
///       * replaces with uploaded downloadURL
///  - Finally removes pending entry.
class ImageCacheService {
  static final ImageCacheService I = ImageCacheService._();
  ImageCacheService._();

  late Box _metaBox;          // image_cache
  late Box _pendingBox;       // pending_uploads
  Directory? _dir;
  bool _init = false;
  bool _syncing = false; // simple mutex

  Future<void> init() async {
    if(_init) return;
    await Hive.initFlutter();
    _metaBox = await Hive.openBox('image_cache');
    _pendingBox = await Hive.openBox('pending_uploads');
    _dir = await getApplicationDocumentsDirectory();
    _init = true;
  }

  /// Returns a local file path (downloading & caching if necessary) for a remote HTTPS image URL.
  Future<String?> getLocalForRemote(String url) async {
    if(!_init) await init();
    if(!url.startsWith('http')) return null;
    url = _normalizeStorageUrl(url);
    final cached = _metaBox.get(url);
    if(cached is Map && cached['local'] is String) {
      final f = File(cached['local']);
      if(await f.exists()) return f.path; // still valid
    }
    try {
      final resp = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 8));
      if(resp.statusCode == 200) {
        final ext = _inferExt(resp.headers['content-type']);
        final file = File('${_dir!.path}/${_hash(url)}$ext');
        await file.writeAsBytes(resp.bodyBytes, flush: true);
        await _metaBox.put(url, { 'local': file.path, 'ts': DateTime.now().millisecondsSinceEpoch });
        return file.path;
      }
    } catch(_) {/* ignore */}
    return null;
  }

  /// Replace image URLs in an update map with local file paths if cached (non-blocking optional prefetch)
  Map<String,dynamic> mapUpdateImages(Map<String,dynamic> update) {
    if(!update.containsKey('images')) return update;
    final imgs = (update['images'] is List)? List.from(update['images']) : [];
    final out = <dynamic>[];
    for(final img in imgs){
      if(img is String && img.startsWith('http')){
        final cached = _metaBox.get(img);
  if(cached is Map && cached['local'] is String){ out.add(cached['local']); }
  else { out.add(img); getLocalForRemote(img).then((_){}); }
      } else { out.add(img); }
    }
    return { ...update, 'images': out };
  }

  /// Queue a local image file for upload with placeholder token inserted into update images list.
  /// Returns the placeholder token string.
  Future<String> queueLocalImageForUpdate({
    required File file,
    required String container, // org or project doc id
    required String containerType, // 'org' | 'project'
    required String updateId,
  }) async {
    if(!_init) await init();
    final token = 'local://${DateTime.now().millisecondsSinceEpoch}_${_rand8()}';
    final pendingId = _hash('$token|$updateId');
  final ext = file.path.contains('.')? '.${file.path.split('.').last}' : '';
  final tempCopy = await file.copy('${_dir!.path}/$pendingId$ext');
    await _pendingBox.put(pendingId, {
      'file': tempCopy.path,
      'container': container,
      'type': containerType,
      'updateId': updateId,
      'token': token,
      'created': DateTime.now().millisecondsSinceEpoch,
    });
    return token;
  }

  /// Queue a user avatar upload for later sync.
  Future<void> queueAvatarUpload({required File file, required String userId}) async {
    if(!_init) await init();
    final id = _hash('avatar|$userId|${DateTime.now().millisecondsSinceEpoch}');
    final ext = file.path.contains('.')? '.${file.path.split('.').last}' : '';
    final tempCopy = await file.copy('${_dir!.path}/$id$ext');
    await _pendingBox.put(id, {
      'kind': 'avatar',
      'file': tempCopy.path,
      'userId': userId,
      'created': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Queue a project cover image upload; on sync, uploads to Storage and updates projects/{id}.coverPhotoUrl
  Future<void> queueProjectCoverUpload({required File file, required String projectDocId}) async {
    if(!_init) await init();
    final id = _hash('project_cover|$projectDocId|${DateTime.now().millisecondsSinceEpoch}');
    final ext = file.path.contains('.')? '.${file.path.split('.').last}' : '';
    final tempCopy = await file.copy('${_dir!.path}/$id$ext');
    await _pendingBox.put(id, {
      'kind': 'project_cover',
      'file': tempCopy.path,
      'projectDocId': projectDocId,
      'created': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Queue an organization cover image upload; on sync, uploads to Storage and updates organizations/{id}.coverPhotoUrl
  Future<void> queueOrgCoverUpload({required File file, required String orgDocId}) async {
    if(!_init) await init();
    final id = _hash('org_cover|$orgDocId|${DateTime.now().millisecondsSinceEpoch}');
    final ext = file.path.contains('.')? '.${file.path.split('.').last}' : '';
    final tempCopy = await file.copy('${_dir!.path}/$id$ext');
    await _pendingBox.put(id, {
      'kind': 'org_cover',
      'file': tempCopy.path,
      'orgDocId': orgDocId,
      'created': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Directly record a remote->local cache mapping without downloading (useful after uploading a file).
  Future<void> cacheRemoteMapping(String remoteUrl, String localPath) async {
    if(!_init) await init();
    await _metaBox.put(remoteUrl, { 'local': localPath, 'ts': DateTime.now().millisecondsSinceEpoch });
  }

  /// Store a local cover image path for a project (device-only mapping)
  Future<void> setProjectLocalCover(String projectDocId, String localPath) async {
    if(!_init) await init();
    await _metaBox.put('projectCover:$projectDocId', { 'local': localPath, 'ts': DateTime.now().millisecondsSinceEpoch });
  }

  /// Get a locally stored cover image path for a project if available
  String? getProjectLocalCoverSync(String projectDocId) {
    if(!_init) return null;
    final rec = _metaBox.get('projectCover:$projectDocId');
    if(rec is Map && rec['local'] is String){
      final f = File(rec['local']);
      if(f.existsSync()) return rec['local'];
    }
    return null;
  }

  /// Store a local cover image path for an organization (device-only mapping)
  Future<void> setOrgLocalCover(String orgDocId, String localPath) async {
    if(!_init) await init();
    await _metaBox.put('orgCover:$orgDocId', { 'local': localPath, 'ts': DateTime.now().millisecondsSinceEpoch });
  }

  /// Get a locally stored cover image path for an organization if available
  String? getOrgLocalCoverSync(String orgDocId) {
    if(!_init) return null;
    final rec = _metaBox.get('orgCover:$orgDocId');
    if(rec is Map && rec['local'] is String){
      final f = File(rec['local']);
      if(f.existsSync()) return rec['local'];
    }
    return null;
  }

  /// Store a local logo image path for an organization (device-only mapping)
  Future<void> setOrgLocalLogo(String orgDocId, String localPath) async {
    if(!_init) await init();
    await _metaBox.put('orgLogo:$orgDocId', { 'local': localPath, 'ts': DateTime.now().millisecondsSinceEpoch });
  }

  /// Get a locally stored logo image path for an organization if available
  String? getOrgLocalLogoSync(String orgDocId) {
    if(!_init) return null;
    final rec = _metaBox.get('orgLogo:$orgDocId');
    if(rec is Map && rec['local'] is String){
      final f = File(rec['local']);
      if(f.existsSync()) return rec['local'];
    }
    return null;
  }

  /// Trigger background sync (can be called on app resume / periodic timer).
  Future<void> syncPending() async {
    if(_syncing) return; _syncing = true;
    if(!_init) await init();
    final authUser = FirebaseAuth.instance.currentUser;
    if(authUser == null) return;
    final keys = _pendingBox.keys.toList();
    for(final k in keys){
      final rec = _pendingBox.get(k);
      if(rec is! Map) continue;
      final path = rec['file'];
      final file = File(path);
      if(!(await file.exists())) { await _pendingBox.delete(k); continue; }
      try {
        if(rec['kind'] == 'avatar'){
          final userId = rec['userId'];
          final storagePath = 'users/$userId/avatar/${DateTime.now().millisecondsSinceEpoch}_${file.uri.pathSegments.last}';
          final ref = FirebaseStorage.instance.ref(storagePath);
          await ref.putFile(file, SettableMetadata(contentType: 'image/${file.path.split('.').last}'));
          final url = await ref.getDownloadURL();
          // Update users doc and cache mapping
          await FirebaseFirestore.instance.collection('users').doc(userId).set({ 'photoURL': url, 'updatedAt': FieldValue.serverTimestamp() }, SetOptions(merge: true));
          await cacheRemoteMapping(url, file.path);
          await _pendingBox.delete(k);
        } else if (rec['kind'] == 'project_cover') {
          final projectDocId = rec['projectDocId'];
          final storagePath = 'projects/$projectDocId/cover/${DateTime.now().millisecondsSinceEpoch}_${file.uri.pathSegments.last}';
          final ref = FirebaseStorage.instance.ref(storagePath);
          await ref.putFile(file, SettableMetadata(contentType: 'image/${file.path.split('.').last}'));
          final url = await ref.getDownloadURL();
          // Update project doc and cache mapping
          final docRef = FirebaseFirestore.instance.collection('projects').doc(projectDocId);
          await docRef.set({ 'coverPhotoUrl': url, 'updatedAt': FieldValue.serverTimestamp() }, SetOptions(merge: true));
          await cacheRemoteMapping(url, file.path);
          await _pendingBox.delete(k);
        } else if (rec['kind'] == 'org_cover') {
          final orgDocId = rec['orgDocId'];
          final storagePath = 'organizations/$orgDocId/cover/${DateTime.now().millisecondsSinceEpoch}_${file.uri.pathSegments.last}';
          final ref = FirebaseStorage.instance.ref(storagePath);
          await ref.putFile(file, SettableMetadata(contentType: 'image/${file.path.split('.').last}'));
          final url = await ref.getDownloadURL();
          // Update organization doc and cache mapping
          final docRef = FirebaseFirestore.instance.collection('organizations').doc(orgDocId);
          await docRef.set({ 'coverPhotoUrl': url, 'updatedAt': FieldValue.serverTimestamp() }, SetOptions(merge: true));
          await cacheRemoteMapping(url, file.path);
          await _pendingBox.delete(k);
        } else if (rec['kind'] == 'org_logo') {
          final orgDocId = rec['orgDocId'];
          final storagePath = 'organizations/$orgDocId/logo/${DateTime.now().millisecondsSinceEpoch}_${file.uri.pathSegments.last}';
          final ref = FirebaseStorage.instance.ref(storagePath);
          await ref.putFile(file, SettableMetadata(contentType: 'image/${file.path.split('.').last}'));
          final url = await ref.getDownloadURL();
          // Update organization doc and cache mapping
          final docRef = FirebaseFirestore.instance.collection('organizations').doc(orgDocId);
          await docRef.set({ 'logoUrl': url, 'updatedAt': FieldValue.serverTimestamp() }, SetOptions(merge: true));
          await cacheRemoteMapping(url, file.path);
          await _pendingBox.delete(k);
        } else {
          // default: update image with placeholder token replacement
          final container = rec['container'];
          final containerType = rec['type'];
          final updateId = rec['updateId'];
          final token = rec['token'];
          final storagePath = '${containerType == 'project' ? 'projects':'organizations'}/$container/updates/images/${DateTime.now().millisecondsSinceEpoch}_${file.uri.pathSegments.last}';
          final ref = FirebaseStorage.instance.ref(storagePath);
          await ref.putFile(file, SettableMetadata(contentType: 'image/${file.path.split('.').last}'));
          final url = await ref.getDownloadURL();
          // Replace token in updates array
          final docRef = FirebaseFirestore.instance.collection(containerType=='project'? 'projects':'organizations').doc(container);
          await FirebaseFirestore.instance.runTransaction((tx) async {
            final snap = await tx.get(docRef); if(!snap.exists) return;
            final data = snap.data() ?? {};
            final updates = (data['updates'] is List)? List<Map<String,dynamic>>.from(data['updates'].map((e)=> Map<String,dynamic>.from(e))) : <Map<String,dynamic>>[];
            bool changed = false;
              for(int i=0;i<updates.length;i++){
                final u = updates[i];
                if(updateId == 'PENDING' || u['updateId'] == updateId){
                  if(u['images'] is List){
                    final imgs = List.from(u['images']);
                    for(int j=0;j<imgs.length;j++){
                      if(imgs[j] == token){ imgs[j] = url; changed = true; }
                    }
                    if(changed){ u['images'] = imgs; updates[i] = u; }
                  }
                }
              }
            if(changed){ tx.update(docRef, { 'updates': updates }); }
          });
          // record cache mapping for the uploaded url to local file to avoid re-download
          await cacheRemoteMapping(url, file.path);
          await _pendingBox.delete(k);
        }
      } catch(e){
        if(kDebugMode){ debugPrint('Image sync failed for $k: $e'); }
      }
    }
    _syncing = false;
  }

  /// Queue an organization logo image upload; on sync, uploads to Storage and updates organizations/{id}.logoUrl
  Future<void> queueOrgLogoUpload({required File file, required String orgDocId}) async {
    if(!_init) await init();
    final id = _hash('org_logo|$orgDocId|${DateTime.now().millisecondsSinceEpoch}');
    final ext = file.path.contains('.')? '.${file.path.split('.').last}' : '';
    final tempCopy = await file.copy('${_dir!.path}/$id$ext');
    await _pendingBox.put(id, {
      'kind': 'org_logo',
      'file': tempCopy.path,
      'orgDocId': orgDocId,
      'created': DateTime.now().millisecondsSinceEpoch,
    });
  }

  String _inferExt(String? ct){
    if(ct==null) return '.img';
    if(ct.contains('png')) return '.png';
    if(ct.contains('jpeg')) return '.jpg';
    if(ct.contains('jpg')) return '.jpg';
    if(ct.contains('webp')) return '.webp';
    return '.img';
  }
  String _hash(String input){
    return base64Url.encode(md5.convert(utf8.encode(input)).bytes).replaceAll('=','');
  }
  String _rand8(){
    final r = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    return r.substring(r.length-8);
  }

  String _normalizeStorageUrl(String url){
    var out = url;
    if (out.contains('firebasestorage.app')) {
      out = out.replaceFirst('firebasestorage.app', 'firebasestorage.googleapis.com');
    }
    if (out.contains('firebasestorage.googleapis.com')) {
      final idx = out.indexOf('/b/');
      if (idx != -1) {
        final start = idx + 3;
        final end = out.indexOf('/o/', start);
        if (end != -1) {
          final bucket = out.substring(start, end);
          final fixedBucket = bucket.replaceAll('.firebasestorage.app', '');
          if (fixedBucket != bucket) {
            out = out.substring(0, start) + fixedBucket + out.substring(end);
          }
        }
      }
    }
    return out;
  }
}
