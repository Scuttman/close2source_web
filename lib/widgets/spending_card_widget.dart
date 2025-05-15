import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:io'; // Import for Image.file
import '../data/models/spending_entry.dart'; // Adjust this import path to the actual location of your SpendingEntry class

class SpendingCardWidget extends StatefulWidget {
  final SpendingEntry tx;
  final String currency;

  const SpendingCardWidget({
    super.key,
    required this.tx,
    required this.currency,
  });

  @override
  State<SpendingCardWidget> createState() => _SpendingCardWidgetState();
}

class _SpendingCardWidgetState extends State<SpendingCardWidget> {
  bool _isExpanded = false;
  String? _selectedImage; // <-- full view image

  // Helper method to handle both network and local images
  Widget _buildImage(
    String path, {
    double height = 100,
    double width = 100,
    BoxFit fit = BoxFit.cover,
  }) {
    try {
      final isNetwork = path.startsWith('http') || path.startsWith('https');

      return isNetwork
          ? CachedNetworkImage(
            imageUrl: path,
            height: height,
            width: width,
            fit: fit,
            placeholder: (context, url) => const CircularProgressIndicator(),
            errorWidget: (context, url, error) {
              print('Error loading network image: $path');
              return const Icon(Icons.broken_image);
            },
          )
          : Image.file(
            File(path),
            height: height,
            width: width,
            fit: fit,
            errorBuilder: (context, error, stackTrace) {
              print('Error loading local image: $path');
              return const Icon(Icons.broken_image);
            },
          );
    } catch (e) {
      print('Exception building image widget: $e');
      return const Icon(Icons.broken_image);
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = widget.tx.date;
    final formattedAmount = NumberFormat.currency(
      locale: 'en_US',
      symbol: '',
      decimalDigits: 2,
    ).format(widget.tx.amount);

    return Card(
      color: Colors.white.withOpacity(0.95),
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () {
          setState(() {
            _isExpanded = !_isExpanded;
            _selectedImage = null; // reset image view on toggle
          });
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const CircleAvatar(
                    backgroundColor: Colors.deepOrange,
                    child: Icon(Icons.shopping_cart, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.tx.description,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          DateFormat('dd MMM yyyy • hh:mm a').format(date),
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 13,
                          ),
                        ),
                        Text(
                          'Category: ${widget.tx.category}',
                          style: const TextStyle(
                            color: Colors.black,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '${widget.currency} $formattedAmount',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Colors.redAccent,
                    ),
                  ),
                ],
              ),

              // Expanded content
              if (_isExpanded) ...[
                const SizedBox(height: 12),
                if (widget.tx.receiptImages.isNotEmpty)
                  _selectedImage != null
                      ? GestureDetector(
                        onTap: () {
                          setState(() => _selectedImage = null);
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Full Receipt View:',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 10),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(
                                16,
                              ), // Rounded corners
                              child: _buildImage(
                                _selectedImage!,
                                height: 250,
                                width: double.infinity,
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Tap image to close full view',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      )
                      : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Receipts:',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children:
                                widget.tx.receiptImages.map((path) {
                                  return GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        _selectedImage = path;
                                      });
                                    },
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(
                                        10,
                                      ), // Rounded corners for thumbnails
                                      child: _buildImage(path),
                                    ),
                                  );
                                }).toList(),
                          ),
                        ],
                      )
                else
                  const Text(
                    'No receipts attached.',
                    style: TextStyle(fontSize: 13, color: Colors.grey),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
