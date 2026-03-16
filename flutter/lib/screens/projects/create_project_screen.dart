import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../services/project_service.dart';
import '../../services/image_cache_service.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

class CreateProjectScreen extends StatefulWidget {
  const CreateProjectScreen({super.key, this.orgDbId, this.orgCode});
  const CreateProjectScreen.prefilledForOrganization({super.key, required this.orgDbId, required this.orgCode});

  final String? orgDbId; // when provided, defaults context to organization
  final String? orgCode;

  @override
  State<CreateProjectScreen> createState() => _CreateProjectScreenState();
}

class _CreateProjectScreenState extends State<CreateProjectScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  String _context = 'personal'; // 'personal' | 'organization' | 'individual'
  String? _selectedOrgDbId;
  String? _selectedOrgCode;

  String? _selectedIndDbId;
  String? _selectedIndCode;
  bool _linkIndividualLater = false;

  bool _submitting = false;
  String _error = '';

  // Stepper state
  int _currentStep = 0; // 0=context, 1=details, 2=image (optional), 3=review

  // Image selection
  String? _localCoverPath; // local file path
  String? _remoteCoverUrl; // if available

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    if (widget.orgDbId != null && widget.orgCode != null) {
      _context = 'organization';
      _selectedOrgDbId = widget.orgDbId;
      _selectedOrgCode = widget.orgCode;
    }
  }

  Future<void> _submit() async {
    setState(() { _error = ''; });
    if (!_formKey.currentState!.validate()) { setState(() { _currentStep = 1; }); return; }
    if (_context == 'organization' && (_selectedOrgDbId == null || _selectedOrgCode == null)) {
      setState(() { _error = 'Please select an organization.'; _currentStep = 0; });
      return;
    }
    if (_context == 'individual' && !_linkIndividualLater && (_selectedIndDbId == null || _selectedIndCode == null)) {
      setState(() { _error = 'Please select an individual or choose "Link later".'; _currentStep = 0; });
      return;
    }
    setState(() { _submitting = true; });
    try {
      final newRef = await ProjectService.instance.createProject(
        name: _nameCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        contextType: _context,
        organizationDbId: _selectedOrgDbId,
        organizationId: _selectedOrgCode,
        individualDbId: _selectedIndDbId,
        individualId: _selectedIndCode,
        linkLater: _linkIndividualLater,
      );
      if (!mounted) return;
      // If a cover image was selected, queue for upload and store local mapping for immediate UI use
      if (_localCoverPath != null) {
        await ImageCacheService.I.setProjectLocalCover(newRef.id, _localCoverPath!);
        await ImageCacheService.I.queueProjectCoverUpload(file: File(_localCoverPath!), projectDocId: newRef.id);
      }
  if (!mounted) return; // double-check
  Navigator.of(context).pop(true);
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Project'),
      ),
      body: SafeArea(
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue: () {
            if (_currentStep == 0) { setState(() { _currentStep = 1; }); return; }
            if (_currentStep == 1) {
              if (_formKey.currentState!.validate()) { setState(() { _currentStep = 2; }); }
              return;
            }
            if (_currentStep == 2) { setState(() { _currentStep = 3; }); return; }
            if (_currentStep == 3) { _submit(); return; }
          },
          onStepCancel: () {
            if (_currentStep > 0) {
              setState(() { _currentStep--; });
            } else {
              Navigator.of(context).pop();
            }
          },
          controlsBuilder: (context, details) {
            return Row(
              children: [
                FilledButton(onPressed: _submitting ? null : details.onStepContinue, child: Text(_currentStep == 3 ? 'Create' : 'Next')),
                const SizedBox(width: 12),
                TextButton(onPressed: _submitting ? null : details.onStepCancel, child: const Text('Back')),
              ],
            );
          },
          steps: [
            Step(
              isActive: _currentStep >= 0,
              title: const Text('Context'),
              // ignore: prefer_const_constructors
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_error.isNotEmpty)
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error, style: const TextStyle(color: Colors.red))),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: SegmentedButton<String>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(value: 'personal', label: Text('Personal', softWrap: false, overflow: TextOverflow.ellipsis)), 
                        ButtonSegment(value: 'organization', label: Text('Org', softWrap: false, overflow: TextOverflow.ellipsis)),
                        ButtonSegment(value: 'individual', label: Text('Indiv', softWrap: false, overflow: TextOverflow.ellipsis)),
                      ],
                      selected: {_context},
                      onSelectionChanged: (s) => setState(() { _context = s.first; }),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_context == 'organization') _OrgSelector(
                    onSelected: (dbId, code){ setState((){ _selectedOrgDbId = dbId; _selectedOrgCode = code; }); },
                    userUid: user?.uid,
                  ),
                  if (_context == 'individual') _IndividualSelector(
                    onSelected: (dbId, code){ setState((){ _selectedIndDbId = dbId; _selectedIndCode = code; }); },
                    onLinkLaterChanged: (v){ setState((){ _linkIndividualLater = v; if (v){ _selectedIndDbId=null; _selectedIndCode=null; } }); },
                    linkLater: _linkIndividualLater,
                    userUid: user?.uid,
                  ),
                  if (_context == 'individual' && _linkIndividualLater)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Share the generated project code with the individual after creation so they can link later.',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
            Step(
              isActive: _currentStep >= 1,
              title: const Text('Details'),
              content: Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Project name'),
                      validator: (v) => (v==null || v.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _descCtrl,
                      minLines: 2,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: 'Description'),
                    ),
                  ],
                ),
              ),
            ),
            Step(
              isActive: _currentStep >= 2,
              title: const Text('Image (optional)'),
              content: _CoverImagePicker(
                localPath: _localCoverPath,
                onLocalPicked: (p){ setState(()=> _localCoverPath = p); },
                remoteUrl: _remoteCoverUrl,
              ),
            ),
            Step(
              isActive: _currentStep >= 3,
              title: const Text('Review & Create'),
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ignore: prefer_const_constructors
                  Text('Context: ${_context[0].toUpperCase()}${_context.substring(1)}'),
                  if (_selectedOrgCode != null)
                    // ignore: prefer_const_constructors
                    Text('Organization: $_selectedOrgCode'),
                  if (_selectedIndCode != null)
                    // ignore: prefer_const_constructors
                    Text('Individual: $_selectedIndCode'),
                  const SizedBox(height: 8),
                  // ignore: prefer_const_constructors
                  Text('Name: ${_nameCtrl.text}'),
                  if (_descCtrl.text.isNotEmpty)
                    // ignore: prefer_const_constructors
                    Text('Description: ${_descCtrl.text}'),
                  if (_localCoverPath != null)
                    // ignore: prefer_const_constructors
                    Text('Cover image selected (will upload on sync if offline)'),
                  if (_error.isNotEmpty)
                    // ignore: prefer_const_constructors
                    Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error, style: const TextStyle(color: Colors.red))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrgSelector extends StatelessWidget {
  final String? userUid;
  final void Function(String dbId, String code) onSelected;
  const _OrgSelector({required this.onSelected, required this.userUid});

  @override
  Widget build(BuildContext context) {
    final q = FirebaseFirestore.instance
        .collection('organizations')
        .where('ownerUid', isEqualTo: userUid)
        .limit(100)
        .snapshots();
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: q,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        final docs = snap.data?.docs ?? [];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Select Organization', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              isExpanded: true,
              items: [
                for (final d in docs)
                  DropdownMenuItem(
                    value: d.id,
                    child: Text(
                      d.data()['name'] ?? d.id,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v){
                if (v == null) return;
                final d = docs.firstWhere((e) => e.id == v);
                final code = (d.data()['orgId'] ?? d.id).toString();
                onSelected(d.id, code);
              },
              decoration: const InputDecoration(labelText: 'Organization'),
            ),
          ],
        );
      },
    );
  }
}

class _IndividualSelector extends StatelessWidget {
  final String? userUid;
  final void Function(String dbId, String code) onSelected;
  final bool linkLater;
  final void Function(bool) onLinkLaterChanged;
  const _IndividualSelector({required this.onSelected, required this.userUid, required this.linkLater, required this.onLinkLaterChanged});

  @override
  Widget build(BuildContext context) {
    final q = FirebaseFirestore.instance
        .collection('individuals')
        .where('ownerUid', isEqualTo: userUid)
        .limit(100)
        .snapshots();
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: q,
      builder: (context, snap) {
        final docs = snap.data?.docs ?? [];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Select Individual', style: Theme.of(context).textTheme.titleSmall),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
              value: linkLater,
              onChanged: (v){ onLinkLaterChanged(v ?? false); },
              title: const Text('Link later with project code'),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              isExpanded: true,
              items: [
                for (final d in docs)
                  DropdownMenuItem(
                    value: d.id,
                    child: Text(
                      d.data()['name'] ?? d.id,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: linkLater ? null : (v){
                if (v == null) return;
                final d = docs.firstWhere((e) => e.id == v);
                final code = (d.data()['individualId'] ?? d.id).toString();
                onSelected(d.id, code);
              },
              decoration: InputDecoration(labelText: 'Individual', hintText: linkLater ? 'Not required when linking later' : null),
            ),
          ],
        );
      },
    );
  }
}

class _CoverImagePicker extends StatefulWidget {
  final String? localPath;
  final void Function(String path) onLocalPicked;
  final String? remoteUrl;
  const _CoverImagePicker({required this.localPath, required this.onLocalPicked, required this.remoteUrl});

  @override
  State<_CoverImagePicker> createState() => _CoverImagePickerState();
}

class _CoverImagePickerState extends State<_CoverImagePicker> {
  bool _processing = false;
  String? _error;

  Future<void> _pick(ImageSource src) async {
    setState(()=> _error=null);
    try {
      final picker = ImagePicker();
      final x = await picker.pickImage(source: src, maxWidth: 2000);
      if (x == null) return;
      final out = await _compressMaxWidth(File(x.path), 500);
      widget.onLocalPicked(out.path);
    } catch (e){ setState(()=> _error = e.toString()); }
  }

  Future<File> _compressMaxWidth(File input, int maxWidth) async {
    setState(()=> _processing = true);
    try {
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
    } finally {
      setState(()=> _processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_error != null)
          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
        Container(
          height: 160,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Positioned.fill(
                child: widget.localPath != null
                    ? Image.file(File(widget.localPath!), fit: BoxFit.cover)
                    : (widget.remoteUrl != null
                        ? Image.network(widget.remoteUrl!, fit: BoxFit.cover)
                        : Center(child: Text('No image selected', style: TextStyle(color: Colors.white.withValues(alpha: 0.7))))),
              ),
              if (_processing)
                const Positioned.fill(child: ColoredBox(color: Colors.black26)),
              if (_processing)
                const Positioned.fill(child: Center(child: CircularProgressIndicator())),
            ],
          ),
        ),
  const SizedBox(height: 8),
        Row(
          children: [
            OutlinedButton.icon(onPressed: _processing? null : () => _pick(ImageSource.gallery), icon: const Icon(Icons.photo), label: const Text('Gallery')),
            const SizedBox(width: 8),
            OutlinedButton.icon(onPressed: _processing? null : () => _pick(ImageSource.camera), icon: const Icon(Icons.photo_camera), label: const Text('Camera')),
          ],
        ),
        const SizedBox(height: 4),
  Text('Landscape recommended. Will be compressed to max width 500px, preserving aspect ratio.', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12)),
      ],
    );
  }
}
