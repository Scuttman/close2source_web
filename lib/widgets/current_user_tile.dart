import '../imports.dart';

class CurrentUserTile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    if (user == null) {
      return ListTile(
        leading: Icon(Icons.account_circle, size: 40, color: Colors.grey),
        title: Text("Guest User", style: TextStyle(fontSize: 16)),
        subtitle: Text("Not logged in"),
      );
    }

    return ListTile(
      leading: CircleAvatar(
        backgroundImage: user.photoURL != null
            ? NetworkImage(user.photoURL!)
            : AssetImage('assets/images/default_avatar.png') as ImageProvider,
        radius: 20,
      ),
      title: Text(user.displayName ?? "Unknown User", style: TextStyle(fontSize: 16, color: Colors.black)),
      subtitle: Text(user.email ?? "No email available"),
    );
  }
}