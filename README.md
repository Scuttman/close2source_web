
# close2source

close2source is a modern web platform built with Next.js, Firebase, and Tailwind CSS, designed to connect donors and supporters with impactful projects and individuals, with a focus on African farming and community initiatives.



## Features

- **Modern UI/UX**: Responsive, branded interface with a custom color palette and full-screen African farming background.
- **User Registration & Authentication**: Secure sign-up and login using Firebase Auth, with role selection (User/Project/Individual).
- **Project Profiles**: Register, search, and view project dashboards with unique codes and real-time updates.
- **Individual Profiles**: Create fundraising or personal update profiles, searchable and accessible at `/i?id=CODE`.
- **Profile Management**: Editable user and project/individual profiles with bio, profile photo upload (Firebase Storage), and role display.
- **Credits System**: Users can purchase credits, which are displayed in real time in the navbar and used for platform interactions.
- **AI-Powered Description Improvement**: On any project page, users can click "Improve with AI" to enhance the project description using an AI service. Each use costs 2 credits, which are deducted from the user's balance and logged in the credit statement. (A mock AI service is provided and can be replaced with a real ChatGPT endpoint.)
- **Real-Time Updates**: Credit balances and profile changes update instantly using Firestore streams (onSnapshot).
- **Secure Data**: Firestore and Storage security rules protect user data and images.
- **GitHub Integration**: Full version control and backup using Git and GitHub.



## Project Structure

- `/app` — Next.js app directory (pages, registration, project & individual profiles, credits, etc.)
- `/components` — Reusable UI components (NavBar, UserHero)
- `/public` — Static assets and images
- `/src/lib` — Firebase configuration and utilities
- `firestore.rules`, `storage.rules` — Security rules for Firestore and Storage
- `tailwind.config.ts` — Tailwind CSS configuration
- `next.config.ts` — Next.js configuration (image domains)



## Key Implementation Details

- **Registration Flow**: Users select a role and create a profile, which is stored in Firestore.
- **Project & Individual Profiles**: Projects and individuals have unique codes and dashboard pages. Individual profiles can be fundraising or personal update types, and are accessible at `/i?id=CODE`.
- **Search & Listing**: Both projects and individuals are listed with search and filter functionality.
- **Profile Page**: Users can update their bio and profile image, with changes reflected in real time.
- **Credits Purchase**: Users can buy credits, which update their Firestore profile and are shown instantly in the navbar.
- **AI Description Improvement**: Project descriptions are editable. The "Improve with AI" button sends the text to a mock AI service (see `src/lib/ai.ts`), updates the description, saves it to Firestore, deducts 2 credits, and logs the transaction. The mock can be replaced with a real API call.
- **Real-Time Navbar**: The UserHero component listens to Firestore for live credit balance updates.
- **Security**: Firestore and Storage rules restrict access to user data and images.



## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Firebase (Auth, Firestore, Storage) and update `/src/lib/firebase.ts` with your config
4. (Optional) To use a real AI endpoint, update `src/lib/ai.ts` to call your API instead of the mock.
4. Run locally: `npm run dev`



## Next Steps

- Add more project/individual features
- Enhance credits usage and transaction history
- Improve UI/UX and accessibility
- Expand security and testing

---


**close2source** — Empowering direct support for impactful projects and individuals.
