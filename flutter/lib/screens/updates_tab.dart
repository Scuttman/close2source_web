import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/branding.dart';
import '../services/image_cache_service.dart';

/*
Flutter analogue of web ProjectUpdatesTab (simplified):
Features implemented:
- List updates (project orgId -> organizations/{orgId} doc currently; adjust path if dedicated project doc)
- Create update (title, text, tags, images, attachments, slideshow flag)
- Reactions (like, love, pray)
- Comments with replies
Simplifications vs web:
- No inline lightbox slideshow navigation (tap opens full-screen page)
- Limited image grid layouts (1-4 images); >4 collapses into 4 + "+N" overlay
- Basic tag search & filter
Assumption: Updates stored in organizations/{orgId}.updates array like web's projects collection. Adjust COLLECTION constant if needed.
*/

class UpdatesTab extends StatefulWidget {
  final String orgId; // Firestore organization document id OR project doc id when forceProject=true
  final String orgCode; // The stable organization code stored in project documents as organizationId
  final Map<String, dynamic> orgData; // expects 'updates' array
  final bool allowEdit;
  final bool forceProject; // when true, use projects collection with projectDocId
  final String? projectDocId; // required when forceProject=true
  const UpdatesTab({
    super.key,
    required this.orgId,
    required this.orgCode,
    required this.orgData,
    required this.allowEdit,
    this.forceProject = false,
    this.projectDocId,
  });

  @override
  State<UpdatesTab> createState() => _UpdatesTabState();
}

class _UpdatesTabState extends State<UpdatesTab> {
  String search = '';
  String tagFilter = '';
  bool showComposer = false;

  // Dynamic resolution: if org doc has no updates, fall back to a project doc whose organizationId == orgCode
  bool _useProjectDoc = false;
  String? _projectDocId;
  bool _projectLookupStarted = false;

  String get _collection => _useProjectDoc && _projectDocId != null ? 'projects' : 'organizations';
  String get _docId => _useProjectDoc && _projectDocId != null ? _projectDocId! : widget.orgId;

  // Removed legacy _updatesRaw; live snapshot is the source of truth.

  // Note: filtering is computed from live snapshot further below; this legacy getter was unused.

  Future<void> _postUpdate({required String title, required String text, required List<String> imageUrls, required List<Map<String, dynamic>> documents, required List<String> tags, required bool slideshow}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final newUpdate = {
      'updateId': '${DateTime.now().millisecondsSinceEpoch}_${user.uid.substring(0,4)}',
      'title': title.isNotEmpty ? title : null,
      'text': text,
      'images': imageUrls,
      'slideshow': slideshow && imageUrls.length > 1,
      'createdAt': DateTime.now().toIso8601String(),
      'author': user.displayName ?? user.email ?? user.uid,
      'authorPhotoUrl': user.photoURL,
      'authorUid': user.uid,
      'tags': tags,
      'documents': documents,
      'reactions': {'pray': 0, 'love': 0},
      'reactionUsers': {},
      'comments': [],
    };
  final ref = FirebaseFirestore.instance.collection(_collection).doc(_docId);
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) return;
      final data = snap.data() ?? {};
      final prev = (data['updates'] is List) ? List.from(data['updates']) : [];
      // Mark lastUpdateAt and clear latest pending request if any
      final req = (data['updateRequests'] is List)? List<Map<String,dynamic>>.from(data['updateRequests'].map((e)=> Map<String,dynamic>.from(e))) : <Map<String,dynamic>>[];
      if (req.isNotEmpty) { req[req.length-1]['status'] = 'fulfilled'; }
      tx.update(ref, {'updates': [newUpdate, ...prev], 'lastUpdateAt': FieldValue.serverTimestamp(), 'updateRequests': req});
    });
  }

  Future<void> _requestUpdate() async {
    final user = FirebaseAuth.instance.currentUser; if (user == null) return;
    final ref = FirebaseFirestore.instance.collection(_collection).doc(_docId);
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(ref); if(!snap.exists) return;
      final data = snap.data() ?? {};
      final arr = (data['updateRequests'] is List)? List<Map<String,dynamic>>.from(data['updateRequests'].map((e)=> Map<String,dynamic>.from(e))) : <Map<String,dynamic>>[];
      arr.add({
        'id': '${DateTime.now().millisecondsSinceEpoch}_${user.uid.substring(0,4)}',
        'requesterUid': user.uid,
        'createdAt': FieldValue.serverTimestamp(),
        'status': 'pending',
      });
      tx.update(ref, { 'updateRequests': arr });
    });
    if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Update requested')));
  }

  Future<void> _openScheduleDialog() async {
    final ref = FirebaseFirestore.instance.collection(_collection).doc(_docId);
    final controller = TextEditingController();
    final result = await showDialog<int>(context: context, builder: (ctx){
      return AlertDialog(
        title: const Text('Periodic updates'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Every N days', hintText: 'e.g. 14'),
        ),
        actions: [
          TextButton(onPressed: ()=> Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: (){ final v = int.tryParse(controller.text.trim()); Navigator.pop(ctx, v); }, child: const Text('Save')),
        ],
      );
    });
    if (result != null) {
      await ref.set({'updatePeriodDays': result}, SetOptions(merge: true));
      if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Schedule saved')));
    }
  }

  Future<void> _toggleReaction(int index, String type) async {
    final user = FirebaseAuth.instance.currentUser; if (user == null) return;
    final ref = FirebaseFirestore.instance.collection(_collection).doc(_docId);
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(ref); if(!snap.exists) return;
      final data = snap.data() ?? {};
      final updates = (data['updates'] is List) ? List<Map<String,dynamic>>.from(data['updates'].map((e)=> Map<String,dynamic>.from(e))) : <Map<String,dynamic>>[];
      if(index < 0 || index >= updates.length) return;
      final u = Map<String,dynamic>.from(updates[index]);
      final ru = Map<String,dynamic>.from(u['reactionUsers'] ?? {});
      final arr = (ru[type] is List) ? List<String>.from(ru[type]) : <String>[];
      if(arr.contains(user.uid)) { arr.remove(user.uid); } else { arr.add(user.uid); }
      ru[type] = arr;
      u['reactionUsers'] = ru;
      final legacy = Map<String,dynamic>.from(u['reactions'] ?? {});
      legacy[type] = arr.length;
      u['reactions'] = legacy;
      updates[index] = u;
      tx.update(ref, {'updates': updates});
    });
  }

  Future<void> _addComment(int updateIndex, {String? parentId, required String text}) async {
    final user = FirebaseAuth.instance.currentUser; if(user == null) return;
    final ref = FirebaseFirestore.instance.collection(_collection).doc(_docId);
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final snap = await tx.get(ref); if(!snap.exists) return;
      final data = snap.data() ?? {};
      final updates = (data['updates'] is List) ? List<Map<String,dynamic>>.from(data['updates'].map((e)=> Map<String,dynamic>.from(e))) : <Map<String,dynamic>>[];
      if(updateIndex<0 || updateIndex>=updates.length) return;
      final u = Map<String,dynamic>.from(updates[updateIndex]);
      final comments = (u['comments'] is List) ? List<Map<String,dynamic>>.from(u['comments'].map((c)=> Map<String,dynamic>.from(c))) : <Map<String,dynamic>>[];
      final newComment = {
        'id': '${DateTime.now().millisecondsSinceEpoch}_${user.uid.substring(0,5)}',
        'text': text,
        'author': user.displayName ?? user.email ?? user.uid,
        'authorUid': user.uid,
        'createdAt': DateTime.now().toIso8601String(),
        'replies': <Map<String,dynamic>>[],
      };
      if(parentId == null) {
        comments.add(newComment);
      } else {
        void addReply(List<Map<String,dynamic>> list){
          for(final c in list){
            if(c['id'] == parentId){
              final rList = (c['replies'] is List) ? List<Map<String,dynamic>>.from(c['replies'].map((r)=> Map<String,dynamic>.from(r))) : <Map<String,dynamic>>[];
              rList.add(newComment);
              c['replies'] = rList;
              return;
            }
            if(c['replies'] is List){ addReply(List<Map<String,dynamic>>.from(c['replies'].map((r)=> Map<String,dynamic>.from(r)))); }
          }
        }
        addReply(comments);
      }
      u['comments'] = comments;
      updates[updateIndex] = u;
      tx.update(ref, {'updates': updates});
    });
  }

  @override
  Widget build(BuildContext context) {
    // Initialize forced project targeting on first build
    if (!_projectLookupStarted) {
      _projectLookupStarted = true;
      if (widget.forceProject && widget.projectDocId != null) {
        _useProjectDoc = true;
        _projectDocId = widget.projectDocId;
      }
    }
    return StreamBuilder<DocumentSnapshot<Map<String,dynamic>>>(
      stream: FirebaseFirestore.instance.collection(_collection).doc(_docId).snapshots(),
      builder: (context, snap) {
        final org = snap.data?.data() ?? widget.orgData;
  var updates = (org['updates'] is List) ? (org['updates'] as List).whereType<Map<String,dynamic>>().toList() : <Map<String,dynamic>>[];
  // Map remote image URLs to cached local paths (non-blocking prefetch)
  updates = updates.map((u)=> ImageCacheService.I.mapUpdateImages(u)).toList();
        // If no updates on current collection and we haven't tried project fallback yet, attempt to locate a project
        if(!_useProjectDoc && updates.isEmpty && !widget.forceProject) {
          // Fire and forget project lookup
          FirebaseFirestore.instance.collection('projects').where('organizationId', isEqualTo: widget.orgCode).limit(1).get().then((qs){
            if(qs.docs.isNotEmpty){
              setState(() {
                _projectDocId = qs.docs.first.id;
                _useProjectDoc = true; // switch to project stream
              });
            }
          }).catchError((_){ /* ignore */ });
        }
        // Recompute filtered list from live snapshot instead of stale widget.orgData
        final filtered = updates.where((u){
          final txt = ('${u['text'] ?? ''} ${u['title'] ?? ''}').toLowerCase();
            final matchesSearch = search.isEmpty || txt.contains(search.toLowerCase());
            final tags = (u['tags'] is List) ? (u['tags'] as List).whereType<String>().toList() : <String>[];
            final matchesTag = tagFilter.isEmpty || tags.contains(tagFilter);
            return matchesSearch && matchesTag;
        }).toList();
        final allTags = <String>{};
        for(final u in updates){
          final tags = (u['tags'] is List)? u['tags'].whereType<String>(): const Iterable<String>.empty();
          allTags.addAll(tags);
        }
        // Permissions and scheduling
        final uid = FirebaseAuth.instance.currentUser?.uid;
        final team = (org['teamUids'] is List) ? List<String>.from(org['teamUids']) : const <String>[];
        final owner = (org['owner'] is Map) ? Map<String,dynamic>.from(org['owner']) : <String,dynamic>{};
        final isStaff = (owner['type'] == 'user' && owner['uid'] == uid) || team.contains(uid);
        final canPost = widget.allowEdit && isStaff;

        final int? periodDays = (org['updatePeriodDays'] is int) ? org['updatePeriodDays'] as int : null;
        Timestamp? lastUpdateTs = org['lastUpdateAt'] is Timestamp ? org['lastUpdateAt'] as Timestamp : null;
        if (lastUpdateTs == null && updates.isNotEmpty) {
          // derive from newest update createdAt
          try {
            final sorted = [...updates];
            sorted.sort((a,b){
              int ts(dynamic v){ if(v is Timestamp) return v.millisecondsSinceEpoch; if(v is String){ final dt = DateTime.tryParse(v); return dt?.millisecondsSinceEpoch ?? 0; } return 0; }
              return ts(b['createdAt']) - ts(a['createdAt']);
            });
            final u0 = sorted.first;
            final ca = u0['createdAt'];
            if (ca is Timestamp) { lastUpdateTs = ca; }
            else if (ca is String) { final dt = DateTime.tryParse(ca); if(dt!=null) lastUpdateTs = Timestamp.fromDate(dt); }
          } catch(_){ }
        }
        final bool overdue = (periodDays != null && lastUpdateTs != null)
          ? DateTime.now().difference(lastUpdateTs.toDate()).inDays >= periodDays
          : false;

        return Column(
          children: [
            // Search & Tags
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Search updates...',
                            isDense: true,
                          ),
                          onChanged: (v)=> setState(()=> search = v.trim()),
                        ),
                      ),
                      if(canPost) ...[
                        const SizedBox(width: 12),
                        FilledButton.icon(
                          onPressed: ()=> setState(()=> showComposer = !showComposer),
                          icon: Icon(showComposer? Icons.close : Icons.add, size: 18),
                          label: Text(showComposer? 'Close' : 'New'),
                        ),
                      ] else ...[
                        const SizedBox(width: 12),
                        OutlinedButton.icon(
                          onPressed: _requestUpdate,
                          icon: const Icon(Icons.campaign, size: 18),
                          label: const Text('Request update'),
                        ),
                      ]
                    ],
                  ),
                  if(periodDays != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(overdue ? Icons.warning_amber_rounded : Icons.schedule, size: 16, color: overdue? Colors.amber : Colors.white.withValues(alpha: 0.8)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            lastUpdateTs != null
                              ? 'Updates requested every $periodDays day(s). Last: ${lastUpdateTs.toDate().toLocal().toString().split(".").first}'
                              : 'Updates requested every $periodDays day(s).',
                            style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.8)),
                          ),
                        ),
                        if(!canPost)
                          TextButton(onPressed: _openScheduleDialog, child: const Text('Change', style: TextStyle(fontSize: 12)))
                        else if (overdue)
                          const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Chip(label: Text('Overdue', style: TextStyle(fontSize: 11)), visualDensity: VisualDensity.compact),
                          ),
                      ],
                    ),
                  ] else ...[
                    if(!canPost) Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(onPressed: _openScheduleDialog, icon: const Icon(Icons.alarm_add, size: 16), label: const Text('Schedule periodic updates', style: TextStyle(fontSize: 12))),
                      ),
                    )
                  ],
                ],
              ),
            ),
            if(allTags.isNotEmpty)
              SizedBox(
                height: 38,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    for(final t in allTags.toList()..sort())
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text('#$t'),
                          selected: tagFilter == t,
                          onSelected: (_)=> setState(()=> tagFilter = tagFilter==t? '' : t),
                        ),
                      ),
                  ],
                ),
              ),
            if(showComposer && canPost)
              UpdateComposer(
                orgId: _docId,
                onPosted: () => setState(()=> showComposer = false),
                submit: _postUpdate,
              ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                itemCount: filtered.length,
                itemBuilder: (context, i) {
                  final u = filtered[i];
                  final idx = updates.indexWhere((x)=> x['updateId'] == u['updateId']);
                  return _UpdateCard(
                    update: u,
                    index: idx,
                    orgId: _docId,
                    toggleReaction: _toggleReaction,
                    addComment: _addComment,
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

class UpdateComposer extends StatefulWidget {
  final String orgId; // Keeping param name though it may represent project doc id when fallback in effect.
  final VoidCallback onPosted;
  final Future<void> Function({required String title, required String text, required List<String> imageUrls, required List<Map<String, dynamic>> documents, required List<String> tags, required bool slideshow}) submit;
  const UpdateComposer({super.key, required this.orgId, required this.onPosted, required this.submit});

  @override
  State<UpdateComposer> createState() => _UpdateComposerState();
}

class _UpdateComposerState extends State<UpdateComposer> {
  final _title = TextEditingController();
  final _text = TextEditingController();
  final _tag = TextEditingController();
  final List<String> _tags = [];
  final List<XFile> _images = [];
  final List<PlatformFile> _docs = [];
  bool _posting = false;
  bool _slideshow = false;
  String? _error;

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final res = await picker.pickMultiImage(imageQuality: 85);
    if(res.isNotEmpty){ setState(()=> _images.addAll(res)); }
  }

  Future<void> _pickDocs() async {
    final res = await FilePicker.platform.pickFiles(allowMultiple: true);
    if(res != null){ setState(()=> _docs.addAll(res.files)); }
  }

  void _addTag(){
    final raw = _tag.text.trim().toLowerCase().replaceAll(RegExp(r'^[#]+'), '');
    if(raw.isEmpty) return; if(_tags.contains(raw)) { _tag.clear(); return; }
    setState(()=> _tags.add(raw)); _tag.clear();
  }

  Future<void> _submit() async {
    if(_posting) return; final user = FirebaseAuth.instance.currentUser; if(user == null) return;
    final title = _title.text.trim();
    final text = _text.text.trim();
    if(text.isEmpty && _images.isEmpty && _docs.isEmpty){ setState(()=> _error = 'Nothing to post'); return; }
  setState(() { _posting = true; _error = null; });
    try {
      final storage = FirebaseStorage.instance;
      final imageUrls = <String>[];
      bool online = true;
      try { await InternetAddress.lookup('firebase.google.com').timeout(const Duration(seconds: 3)); } catch(_){ online = false; }
      for(final img in _images){
        if(online){
          final ref = storage.ref().child('organizations/${widget.orgId}/updates/images/${DateTime.now().millisecondsSinceEpoch}_${img.name}');
          final bytes = await img.readAsBytes();
          await ref.putData(bytes, SettableMetadata(contentType: 'image/${img.name.split('.').last}'));
          imageUrls.add(await ref.getDownloadURL());
        } else {
          // queue offline
          final f = File(img.path);
          final placeholder = await ImageCacheService.I.queueLocalImageForUpdate(
            file: f,
            container: widget.orgId,
            containerType: 'org',
            updateId: 'PENDING', // replaced after creation
          );
          imageUrls.add(placeholder);
        }
      }
      final documents = <Map<String,dynamic>>[];
      for(final doc in _docs){
        if(doc.bytes == null) continue;
        final ref = storage.ref().child('organizations/${widget.orgId}/updates/docs/${DateTime.now().millisecondsSinceEpoch}_${doc.name}');
        await ref.putData(doc.bytes!, SettableMetadata(contentType: doc.extension));
        documents.add({'name': doc.name, 'url': await ref.getDownloadURL(), 'size': doc.size});
      }
      await widget.submit(
        title: title,
        text: text,
        imageUrls: imageUrls,
        documents: documents,
        tags: List<String>.from(_tags),
        slideshow: _slideshow,
      );
      if(!online){
        // Trigger background sync attempt (will no-op offline)
        ImageCacheService.I.syncPending();
      }
      setState(() {
        _title.clear();
        _text.clear();
        _tag.clear();
        _tags.clear();
        _images.clear();
        _docs.clear();
        _slideshow = false;
      });
      widget.onPosted();
    } catch(e){ setState(()=> _error = 'Failed to post'); }
    finally { setState(()=> _posting = false); }
  }

  @override
  Widget build(BuildContext context) {
    final doneImageCount = _images.length;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
  color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(18),
  border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Create Update', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Branding.accent, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title (optional)', isDense: true)),
          const SizedBox(height: 8),
          TextField(controller: _text, decoration: const InputDecoration(labelText: "What's new?", alignLabelWithHint: true), maxLines: 5, minLines: 3),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for(final t in _tags) Chip(label: Text('#$t', style: const TextStyle(fontSize: 11)), onDeleted: ()=> setState(()=> _tags.remove(t))),
            SizedBox(
              width: 120,
              child: TextField(
                controller: _tag,
                onSubmitted: (_)=> _addTag(),
                decoration: const InputDecoration(hintText: 'Add tag', isDense: true),
              ),
            )
          ]),
          const SizedBox(height: 8),
          Row(children: [
            ElevatedButton.icon(onPressed: _pickImage, icon: const Icon(Icons.image,size:16), label: const Text('Images')),
            const SizedBox(width: 8),
            ElevatedButton.icon(onPressed: _pickDocs, icon: const Icon(Icons.attach_file,size:16), label: const Text('Docs')),
            const SizedBox(width: 12),
            Row(children: [
              Checkbox(value: _slideshow, onChanged: doneImageCount>1? (v)=> setState(()=> _slideshow = v ?? false): null, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
              const Text('Slideshow', style: TextStyle(fontSize: 12))
            ])
          ]),
          if(_images.isNotEmpty) Padding(
            padding: const EdgeInsets.only(top:8),
            child: SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _images.length,
                separatorBuilder: (_, __) => const SizedBox(width:6),
                itemBuilder: (_,i){
                  final img = _images[i];
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(File(img.path), width: 90, height: 90, fit: BoxFit.cover),
                      ),
                      Positioned(
                        top:4,right:4,
                        child: InkWell(
                          onTap: ()=> setState(()=> _images.removeAt(i)),
                          child: Container(
                            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.all(2),
                            child: const Icon(Icons.close, size:14, color: Colors.white),
                          ),
                        ),
                      )
                    ],
                  );
                },
              ),
            ),
          ),
          if(_docs.isNotEmpty) Padding(
            padding: const EdgeInsets.only(top:8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Attachments', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height:4),
                for(int i=0;i<_docs.length;i++) Row(
                  children: [
                    const Icon(Icons.insert_drive_file, size:16),
                    const SizedBox(width:4),
                    Expanded(child: Text(_docs[i].name, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                    IconButton(onPressed: ()=> setState(()=> _docs.removeAt(i)), icon: const Icon(Icons.close,size:14))
                  ],
                )
              ],
            ),
          ),
          if(_error!=null) Padding(
            padding: const EdgeInsets.only(top:8),
            child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: FilledButton(
                onPressed: _posting? null : _submit,
                child: Text(_posting? 'Posting...' : 'Post'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: _posting? null : (){ setState(() { _title.clear(); _text.clear(); _tag.clear(); _tags.clear(); _images.clear(); _docs.clear(); _slideshow=false; _error=null; }); }, child: const Text('Reset'))
          ])
        ],
      ),
    );
  }
}

class _UpdateCard extends StatelessWidget {
  final Map<String,dynamic> update;
  final int index;
  final String orgId;
  final void Function(int index, String type) toggleReaction;
  final Future<void> Function(int updateIndex, {String? parentId, required String text}) addComment;
  const _UpdateCard({required this.update, required this.index, required this.orgId, required this.toggleReaction, required this.addComment});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final images = (update['images'] is List) ? update['images'].whereType<String>().toList() : <String>[];
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: Branding.accent.withValues(alpha: 0.2),
                backgroundImage: update['authorPhotoUrl']!=null ? NetworkImage(update['authorPhotoUrl']) : null,
                child: update['authorPhotoUrl']==null
                    ? Text(((update['author'] ?? '').toString().isNotEmpty)
                        ? update['author'].toString().substring(0,1).toUpperCase()
                        : 'U')
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(update['author'] ?? 'Unknown', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87))),
              Text(_fmtDate(update['createdAt']), style: const TextStyle(fontSize: 11, color: Colors.black54))
            ],
          ),
          if(update['title']!=null) ...[
            const SizedBox(height: 8),
            Text(update['title'], style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87)),
          ],
          if(images.isNotEmpty) ...[
            const SizedBox(height: 8),
            _ImagesGrid(images: images, slideshow: update['slideshow']==true),
          ],
          if((update['text'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(update['text'], style: const TextStyle(fontSize: 13, color: Colors.black87)),
          ],
          if(update['documents'] is List && (update['documents'] as List).isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text('Attachments', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black87)),
            const SizedBox(height: 4),
            for(final d in (update['documents'] as List)) if(d is Map<String,dynamic>) _DocTile(doc: d),
          ],
          if(update['tags'] is List && (update['tags'] as List).isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 6, children: [
              for(final t in (update['tags'] as List).whereType<String>()) Chip(label: Text('#$t', style: const TextStyle(fontSize: 11, color: Colors.black87)))
            ])
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              _ReactionButton(type: 'like', count: _reactionCount(update,'like'), active: _userReacted(update,'like', user?.uid), onTap: ()=> toggleReaction(index,'like')),
              const SizedBox(width: 8),
              _ReactionButton(type: 'love', count: _reactionCount(update,'love'), active: _userReacted(update,'love', user?.uid), onTap: ()=> toggleReaction(index,'love')),
              const SizedBox(width: 8),
              _ReactionButton(type: 'pray', count: _reactionCount(update,'pray'), active: _userReacted(update,'pray', user?.uid), onTap: ()=> toggleReaction(index,'pray')),
            ],
          ),
          const SizedBox(height: 12),
          _CommentsSection(update: update, updateIndex: index, addComment: addComment),
        ],
      ),
    );
  }

  static String _fmtDate(dynamic iso){
    if(iso is String){
      try { return DateTime.parse(iso).toLocal().toString().replaceFirst(RegExp(r':..\..+'), ''); } catch(_) {}
    }
    return '';
  }

  static int _reactionCount(Map<String,dynamic> u, String type){
    if(u['reactionUsers'] is Map && u['reactionUsers'][type] is List){
      return (u['reactionUsers'][type] as List).length;
    }
    if(u['reactions'] is Map && u['reactions'][type] is int){
      return u['reactions'][type] as int;
    }
    return 0;
  }
  static bool _userReacted(Map<String,dynamic> u, String type, String? uid){
    if(uid==null) return false;
    if(u['reactionUsers'] is Map && u['reactionUsers'][type] is List){
      return (u['reactionUsers'][type] as List).contains(uid);
    }
    return false;
  }
}

class _ImagesGrid extends StatelessWidget {
  final List<String> images; final bool slideshow;
  const _ImagesGrid({required this.images, required this.slideshow});
  @override
  Widget build(BuildContext context) {
    if(images.length==1){
      return _UpdateImage(images.first, width: double.infinity, height: 180);
    }
    final display = images.take(4).toList();
    return Container(
      padding: const EdgeInsets.all(3), // outer 3px padding around the grid
      child: SizedBox(
        height: 180,
        child: Row(
          children: [
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: _UpdateImage(display[0], width: double.infinity),
                  ),
                  if(display.length>2) const SizedBox(height: 3), // 3px gap between stacked images
                  if(display.length>2)
                    Expanded(
                      child: _UpdateImage(display[2], width: double.infinity),
                    ),
                ],
              ),
            ),
            if(display.length>1) const SizedBox(width: 3), // 3px gap between columns
            if(display.length>1)
              Expanded(
                child: Column(
                  children: [
                    Expanded(
                      child: _UpdateImage(display[1], width: double.infinity),
                    ),
                    if(display.length>3) const SizedBox(height: 3), // 3px gap
                    if(display.length>3)
                      Expanded(
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            _UpdateImage(display[3]),
                            if(images.length>4)
                              Container(
                                color: Colors.black54,
                                alignment: Alignment.center,
                                child: Text('+${images.length-4}', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w600)),
                              )
                          ],
                        ),
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

class _ReactionButton extends StatelessWidget {
  final String type; final int count; final bool active; final VoidCallback onTap;
  const _ReactionButton({required this.type, required this.count, required this.active, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final icon = type=='like'? '👍' : type=='love'? '❤️' : '🙏';
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(30),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: active? Branding.accent : Colors.black26),
          color: active? Branding.accent.withValues(alpha: 0.15) : Colors.black.withValues(alpha: 0.05),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon),
            const SizedBox(width: 4),
            Text(count.toString(), style: const TextStyle(fontSize: 12, color: Colors.black87)),
          ],
        ),
      ),
    );
  }
}

class _CommentsSection extends StatefulWidget {
  final Map<String,dynamic> update; final int updateIndex; final Future<void> Function(int, {String? parentId, required String text}) addComment;
  const _CommentsSection({required this.update, required this.updateIndex, required this.addComment});
  @override
  State<_CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends State<_CommentsSection> {
  final _rootController = TextEditingController();
  final Map<String, TextEditingController> _replyCtrls = {};
  bool _posting = false;

  Future<void> _postRoot() async {
  final text = _rootController.text.trim(); if(text.isEmpty) return; setState(() { _posting = true; });
    await widget.addComment(widget.updateIndex, text: text);
  if(mounted) setState(() { _posting = false; _rootController.clear(); });
  }
  Future<void> _postReply(String parentId) async {
  final ctrl = _replyCtrls[parentId]!; final text = ctrl.text.trim(); if(text.isEmpty) return; setState(() { _posting=true; });
    await widget.addComment(widget.updateIndex, parentId: parentId, text: text);
  if(mounted) setState(() { _posting=false; ctrl.clear(); });
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final comments = (widget.update['comments'] is List)? widget.update['comments'].whereType<Map<String,dynamic>>().toList() : <Map<String,dynamic>>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Comments', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Branding.accent, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        if(comments.isEmpty) const Text('No comments yet.', style: TextStyle(fontSize: 12, color: Colors.black54)),
        for(final c in comments) _CommentNode(updateIndex: widget.updateIndex, node: c, replyCtrls: _replyCtrls, postReply: _postReply),
        if(user!=null) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _rootController,
            minLines: 1,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Write a comment...',
              suffixIcon: IconButton(
                icon: _posting? const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2)) : const Icon(Icons.send, size:18),
                onPressed: _posting? null : _postRoot,
              ),
            ),
          )
        ] else ...[
          const SizedBox(height: 6),
          const Text('Sign in to comment.', style: TextStyle(fontSize: 11, color: Colors.black54))
        ]
      ],
    );
  }
}

class _CommentNode extends StatefulWidget {
  final int updateIndex; final Map<String,dynamic> node; final Map<String,TextEditingController> replyCtrls; final Future<void> Function(String parentId) postReply;
  const _CommentNode({required this.updateIndex, required this.node, required this.replyCtrls, required this.postReply});
  @override
  State<_CommentNode> createState() => _CommentNodeState();
}

class _CommentNodeState extends State<_CommentNode> {
  bool replying = false;
  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    final replies = (node['replies'] is List)? node['replies'].whereType<Map<String,dynamic>>().toList() : <Map<String,dynamic>>[];
    final ctrl = widget.replyCtrls.putIfAbsent(node['id'] as String, () => TextEditingController());
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            CircleAvatar(
              radius: 10,
              backgroundColor: Branding.accent.withValues(alpha: 0.2),
              child: Text((((node['author'] ?? '').toString().isNotEmpty)
                  ? node['author'].toString().substring(0,1).toUpperCase()
                  : 'U'), style: const TextStyle(fontSize: 11, color: Colors.black87)),
            ),
            const SizedBox(width: 6),
            Expanded(child: Text(node['author']??'Unknown', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black87))),
            Text(_fmt(node['createdAt']), style: const TextStyle(fontSize: 10, color: Colors.black54))
          ]),
          if((node['text']??'').toString().isNotEmpty) Padding(
            padding: const EdgeInsets.only(top:4),
            child: Text(node['text'], style: const TextStyle(fontSize: 12, color: Colors.black87)),
          ),
          TextButton(
            onPressed: ()=> setState(()=> replying = !replying),
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0,0), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            child: Text(replying? 'Cancel' : 'Reply', style: const TextStyle(fontSize: 11)),
          ),
          if(replying) Padding(
            padding: const EdgeInsets.only(top:4),
            child: TextField(
              controller: ctrl,
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Reply...',
                suffixIcon: IconButton(
                  onPressed: () async { await widget.postReply(node['id'] as String); if(mounted) setState(()=> replying=false); },
                  icon: const Icon(Icons.send, size:16),
                ),
              ),
            ),
          ),
          if(replies.isNotEmpty) Padding(
            padding: const EdgeInsets.only(left:16, top:6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for(final r in replies) _CommentNode(updateIndex: widget.updateIndex, node: r, replyCtrls: widget.replyCtrls, postReply: widget.postReply)
              ],
            ),
          )
        ],
      ),
    );
  }

  static String _fmt(dynamic iso){
    if(iso is String){ try { final dt = DateTime.parse(iso).toLocal(); return '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}'; } catch(_){ } }
    return '';
  }
}

class _DocTile extends StatelessWidget {
  final Map<String,dynamic> doc;
  const _DocTile({required this.doc});
  @override
  Widget build(BuildContext context) {
    final name = (doc['name'] ?? 'file').toString();
    final url = (doc['url'] ?? '').toString();
    final size = (doc['size'] is int) ? doc['size'] as int : 0;
    final ext = name.contains('.') ? name.split('.').last.toUpperCase() : 'DOC';
    return InkWell(
      onTap: () async { if(url.isNotEmpty) { final uri = Uri.parse(url); if(await canLaunchUrl(uri)) { await launchUrl(uri, mode: LaunchMode.externalApplication); } } },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: Branding.accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: Text(ext, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
                  Text(_fmtSize(size), style: const TextStyle(fontSize: 10, color: Colors.black54)),
                ],
              ),
            ),
            const Icon(Icons.open_in_new, size: 16, color: Colors.black54)
          ],
        ),
      ),
    );
  }

  static String _fmtSize(int bytes){
    if(bytes <= 0) return '';
    if(bytes < 1024) return '$bytes B';
    final kb = bytes / 1024;
    if(kb < 1024) return '${kb.toStringAsFixed(1)} KB';
    final mb = kb / 1024; return '${mb.toStringAsFixed(1)} MB';
  }
}

class _UpdateImage extends StatelessWidget {
  final String src; final double? width; final double? height;
  const _UpdateImage(this.src, {this.width, this.height});
  @override
  Widget build(BuildContext context) {
    final isLocal = src.startsWith('/') || src.startsWith('file://');
    final w = width; final h = height;
    if(isLocal){
      final path = src.startsWith('file://') ? src.substring(7) : src;
      return Image.file(File(path), fit: BoxFit.cover, width: w, height: h);
    }
    return Image.network(src, fit: BoxFit.cover, width: w, height: h);
  }
}
