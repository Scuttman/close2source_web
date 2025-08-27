# close2source

close2source is a modern web platform built with Next.js, Firebase, and Tailwind CSS, designed to connect donors and supporters with impactful projects and individuals, with a focus on African farming and community initiatives.

## Features

- **Modern UI/UX**: Responsive, branded interface with a custom color palette and full-screen African farming background.
- **User Registration & Authentication**: Secure sign-up and login using Firebase Auth, with role selection (User/Project/Individual).
- **Profile Management**: Editable user profiles with bio, profile photo upload (Firebase Storage), and role display.
- **Credits System**: Users can purchase credits, which are displayed in real time in the navbar and used for platform interactions.
- **Real-Time Updates**: Credit balances and profile changes update instantly using Firestore streams (onSnapshot).
- **Secure Data**: Firestore and Storage security rules protect user data and images.
- **GitHub Integration**: Full version control and backup using Git and GitHub.

## Project Structure

- `/app` — Next.js app directory (pages, registration, profile, credits, etc.)
- `/components` — Reusable UI components (NavBar, UserHero)
- `/public` — Static assets and images
- `/src/lib` — Firebase configuration and utilities
- `firestore.rules`, `storage.rules` — Security rules for Firestore and Storage
- `tailwind.config.ts` — Tailwind CSS configuration
- `next.config.ts` — Next.js configuration (image domains)

## Key Implementation Details

- **Registration Flow**: Users select a role and create a profile, which is stored in Firestore.
- **Profile Page**: Users can update their bio and profile image, with changes reflected in real time.
- **Credits Purchase**: Users can buy credits, which update their Firestore profile and are shown instantly in the navbar.
- **Real-Time Navbar**: The UserHero component listens to Firestore for live credit balance updates.
- **Security**: Firestore and Storage rules restrict access to user data and images.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Firebase (Auth, Firestore, Storage) and update `/src/lib/firebase.ts` with your config
4. Run locally: `npm run dev`

## Next Steps

- Add more project/individual features
- Enhance credits usage and transaction history
- Improve UI/UX and accessibility
- Expand security and testing

---

**close2source** — Empowering direct support for impactful projects and individuals.
