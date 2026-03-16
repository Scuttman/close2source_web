import 'dart:io';
import 'package:flutter/material.dart';
import '../services/image_cache_service.dart';

class ProjectCoverImage extends StatefulWidget {
  final String projectDocId;
  final String coverUrl;
  final double width;
  final double height;
  final BorderRadius? borderRadius;
  final Widget? fallback;
  final BoxFit fit;

  const ProjectCoverImage({
    super.key,
    required this.projectDocId,
    required this.coverUrl,
    required this.width,
    required this.height,
    this.borderRadius,
    this.fallback,
    this.fit = BoxFit.cover,
  });

  @override
  State<ProjectCoverImage> createState() => _ProjectCoverImageState();
}

class _ProjectCoverImageState extends State<ProjectCoverImage> {
  String? _localPath;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ensureLocal();
  }

  @override
  void didUpdateWidget(covariant ProjectCoverImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.projectDocId != widget.projectDocId || oldWidget.coverUrl != widget.coverUrl) {
      _started = false;
      _localPath = null;
      _ensureLocal();
    }
  }

  Future<void> _ensureLocal() async {
    if (_started) return; _started = true;
    // Check existing project-local mapping first
    try {
      final p = ImageCacheService.I.getProjectLocalCoverSync(widget.projectDocId);
      if (p != null && mounted) { setState(() => _localPath = p); return; }
    } catch (_) {}
    // If no mapping and a remote url exists, download & cache, then set project mapping
    if (widget.coverUrl.isNotEmpty) {
      try {
        final local = await ImageCacheService.I.getLocalForRemote(widget.coverUrl);
        if (local != null) {
          await ImageCacheService.I.setProjectLocalCover(widget.projectDocId, local);
          if (mounted) setState(() => _localPath = local);
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(8);
    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: _buildChild(),
      ),
    );
  }

  Widget _buildChild() {
    if (_localPath != null) {
      final f = File(_localPath!);
      if (f.existsSync()) {
        return Image.file(f, fit: widget.fit);
      }
    }
    if (widget.coverUrl.isNotEmpty) {
      final url = _normalizeStorageUrl(widget.coverUrl);
      return Image.network(
        url,
        fit: widget.fit,
        errorBuilder: (_, __, ___) => widget.fallback ?? const SizedBox.shrink(),
      );
    }
    return widget.fallback ?? const SizedBox.shrink();
  }

  // Some configs expose bucket as '...firebasestorage.app', but public download endpoints use
  // 'firebasestorage.googleapis.com'. Also ensure we do not keep the '.firebasestorage.app' suffix
  // in the bucket path when using the googleapis host.
  String _normalizeStorageUrl(String url) {
    var out = url;
    if (out.contains('firebasestorage.app')) {
      out = out.replaceFirst('firebasestorage.app', 'firebasestorage.googleapis.com');
    }
    // If host is firebasestorage.googleapis.com but the bucket segment still includes
    // '.firebasestorage.app', strip that suffix from the bucket name segment after '/b/'.
    if (out.contains('firebasestorage.googleapis.com')) {
      out = out.replaceAll('/b/', '/b/');
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
