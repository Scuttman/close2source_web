import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import '../../utils/currency.dart';

import '../../services/finance_models.dart';

class TransactionDetailScreen extends StatelessWidget {
  final String profileId;
  final String transactionId;
  final ProjectTransaction? initial;
  const TransactionDetailScreen({super.key, required this.profileId, required this.transactionId, this.initial});

  @override
  Widget build(BuildContext context) {
    final txDoc = FirebaseFirestore.instance
        .collection('profiles')
        .doc(profileId)
        .collection('profileTransactions')
        .doc(transactionId)
        .snapshots(includeMetadataChanges: true);
    final receiptsCol = FirebaseFirestore.instance
        .collection('profiles')
        .doc(profileId)
        .collection('profileTransactions')
        .doc(transactionId)
        .collection('receipts')
        .orderBy('uploadedAt', descending: true)
        .snapshots(includeMetadataChanges: true);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transaction Details'),
      ),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: txDoc,
        builder: (context, snap) {
          ProjectTransaction? tx;
          if (snap.hasData && snap.data?.data() != null) {
            tx = ProjectTransaction.fromDoc(snap.data!);
          } else {
            tx = initial;
          }
          if (tx == null) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            return const Center(child: Text('Transaction not found'));
          }

          final metaPending = snap.data?.metadata.hasPendingWrites == true;
          final typeStr = tx.type.name;
          final eff = tx.effectiveDate.toDate();
          final amount = tx.amount;
          final currency = tx.currency;
          final secondaryAmount = tx.secondaryAmount;
          final secondaryCurrency = tx.secondaryCurrency;
          final reversed = tx.reversed;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Row(
                children: [
                  _chip(typeStr),
                  const SizedBox(width: 8),
                  if (reversed) const Chip(label: Text('Reversed'), backgroundColor: Colors.redAccent),
                  if (metaPending) ...[
                    const SizedBox(width: 8),
                    const Chip(label: Text('Pending…'), backgroundColor: Colors.amber),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              _kv('Amount', formatCurrency(currency, amount)),
              if (secondaryAmount != null)
                _kv('Secondary amount', formatCurrency(secondaryCurrency ?? '', secondaryAmount)),
              _kv('Category', tx.category),
              if ((tx.description ?? '').isNotEmpty) _kv('Description', tx.description!),
              if ((tx.counterpartyName ?? '').isNotEmpty) _kv('Counterparty', tx.counterpartyName!),
              if ((tx.counterpartyContact ?? '').isNotEmpty) _kv('Contact', tx.counterpartyContact!),
              _kv('Date', eff.toLocal().toIso8601String().split('T').first),
              const Divider(height: 24),
              Text('Receipts', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: receiptsCol,
                builder: (context, rSnap) {
                  final items = rSnap.data?.docs ?? const [];
                  if (items.isEmpty) {
                    return Text('No receipts attached', style: TextStyle(color: Colors.white.withValues(alpha: 0.7)));
                  }
                  final metas = items.map(TransactionReceiptMeta.fromDoc).toList();
                  return _ReceiptGrid(profileId: profileId, metas: metas);
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text(k, style: const TextStyle(color: Colors.white70))),
          const SizedBox(width: 8),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  Widget _chip(String t) {
    Color c;
    switch (t) {
      case 'income':
        c = Colors.greenAccent; break;
      case 'expense':
        c = Colors.redAccent; break;
      default:
        c = Colors.amberAccent; break;
    }
    return Chip(label: Text(t[0].toUpperCase()+t.substring(1)), backgroundColor: c.withValues(alpha: 0.2));
  }
}

class _ReceiptGrid extends StatelessWidget {
  final String profileId;
  final List<TransactionReceiptMeta> metas;
  const _ReceiptGrid({required this.profileId, required this.metas});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: metas.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemBuilder: (_, i) => _ReceiptTile(meta: metas[i], index: i, all: metas),
    );
  }
}

class _ReceiptTile extends StatelessWidget {
  final TransactionReceiptMeta meta;
  final int index;
  final List<TransactionReceiptMeta> all;
  const _ReceiptTile({required this.meta, required this.index, required this.all});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: FirebaseStorage.instance.ref(meta.storagePath).getDownloadURL(),
      builder: (context, snap) {
        final url = snap.data;
        return InkWell(
          onTap: url == null ? null : () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => _ImageGallery(urlsFuture: _urlsForAll(all), initialIndex: index),
            ),
          ),
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
              borderRadius: BorderRadius.circular(10),
              color: Colors.white.withValues(alpha: 0.04),
            ),
            clipBehavior: Clip.antiAlias,
            child: url == null
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                  ),
          ),
        );
      },
    );
  }

  Future<List<String>> _urlsForAll(List<TransactionReceiptMeta> metas) async {
    final futures = metas.map((m) => FirebaseStorage.instance.ref(m.storagePath).getDownloadURL());
    return Future.wait(futures);
  }
}

class _ImageGallery extends StatefulWidget {
  final Future<List<String>> urlsFuture;
  final int initialIndex;
  const _ImageGallery({required this.urlsFuture, required this.initialIndex});

  @override
  State<_ImageGallery> createState() => _ImageGalleryState();
}

class _ImageGalleryState extends State<_ImageGallery> {
  late PageController _controller;

  @override
  void initState() {
    super.initState();
    _controller = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<String>>(
      future: widget.urlsFuture,
      builder: (context, snap) {
        final urls = snap.data;
        return Scaffold(
          appBar: AppBar(),
          backgroundColor: Colors.black,
          body: urls == null
              ? const Center(child: CircularProgressIndicator())
              : PageView.builder(
                  controller: _controller,
                  itemCount: urls.length,
                  itemBuilder: (_, i) => InteractiveViewer(
                    panEnabled: true,
                    minScale: 0.8,
                    maxScale: 5,
                    child: Center(
                      child: CachedNetworkImage(
                        imageUrl: urls[i],
                        placeholder: (c, u) => const Center(child: CircularProgressIndicator()),
                        errorWidget: (c, u, e) => const Icon(Icons.broken_image, color: Colors.white70),
                      ),
                    ),
                  ),
                ),
        );
      },
    );
  }
}
