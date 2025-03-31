import 'package:cloud_firestore/cloud_firestore.dart';

class UserProfile {
  final String uid;
  final String forename;
  final String surname;
  final String email;
  final String description;
  final List<UserContact> userContacts; // Updated property name and type.
  final String profileId;
  final String profilePicUrl;
  final DateTime createdAt;

  UserProfile({
    required this.uid,
    required this.forename,
    required this.surname,
    required this.email,
    required this.description,
    required this.userContacts,
    required this.profileId,
    required this.profilePicUrl,
    required this.createdAt,
  });

  /// Factory constructor to create a UserProfile from a Firestore document.
  factory UserProfile.fromMap(Map<String, dynamic> data) {
    return UserProfile(
      uid: data['uid'] ?? '',
      forename: data['forename'] ?? '',
      surname: data['surname'] ?? '',
      email: data['email'] ?? '',
      description: data['description'] ?? '',
      userContacts: data['userContacts'] != null
          ? List<UserContact>.from(
          (data['userContacts'] as List)
              .map((contact) => UserContact.fromMap(contact)))
          : [],
      profileId: data['profileId'] ?? '',
      profilePicUrl: data['profilePicUrl'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  /// Converts the UserProfile instance into a Map to store in Firestore.
  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'forename': forename,
      'surname': surname,
      'email': email,
      'description': description,
      'userContacts': userContacts.map((contact) => contact.toMap()).toList(),
      'profileId': profileId,
      'profilePicUrl': profilePicUrl,
      'createdAt': createdAt,
    };
  }
}

class UserContact {
  final String value;
  final String label;
  final String type; // e.g., "Email" or "Phone"

  UserContact({
    required this.value,
    required this.label,
    required this.type,
  });

  /// Creates a UserContact from a Map.
  factory UserContact.fromMap(Map<String, dynamic> map) {
    return UserContact(
      value: map['value'] ?? '',
      label: map['label'] ?? '',
      type: map['type'] ?? '',
    );
  }

  /// Converts the UserContact instance into a Map.
  Map<String, dynamic> toMap() {
    return {
      'value': value,
      'label': label,
      'type': type,
    };
  }
}