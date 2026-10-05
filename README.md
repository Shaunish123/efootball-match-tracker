# ⚽ eFootball Match & Tournament Tracker

A real-time web application built for local gaming groups to track **eFootball** 1v1 matches, head-to-head records, user analytics, and knockout tournament brackets with instant cross-device data synchronization.

---

## 🔥 Features

- **📊 Live Dashboard & Leaderboard**: Real-time standings sorted by Wins, Goal Difference (**GD**), Goals For (**GF**), and Win Rate.
- **⚽ Detailed Goal Analytics**: Tracks **Goals For (GF)**, **Goals Against (GA)**, and **Goal Difference (GD)** for every player.
- **🤝 Head-to-Head (H2H) Records**: Individual player profile pages showing head-to-head match histories, win rates against specific opponents, and match activity charts.
- **🏆 Knockout Tournament Brackets**: 
  - Supports **4-Player** (Semi-Finals + Final) and **8-Player** (Quarter-Finals + Semi-Finals + Final + 3rd Place Playoff) single-elimination formats.
  - Custom **Round 1 Matchup Selection** (explicitly pair players as decided in-game) + optional auto-fill.
  - Automatic winner progression to subsequent rounds.
  - Automatic 3rd Place playoff generation.
- **🔒 Privacy Rules**: Hidden eFootball Usernames/IDs across all public leaderboards and cards (only visible to admins/account owner for deletion verification).
- **⚡ Live Cross-Device Sync**: Powered by Firebase Realtime Database WebSockets.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Styling**: Tailwind CSS (Dark gaming theme)
- **Database & Realtime Backend**: [Firebase Realtime Database](https://firebase.google.com/products/realtime-database)
- **Charts & Visualizations**: [Recharts](https://recharts.org/)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- A [Firebase](https://console.firebase.google.com/) account

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/YOUR_USERNAME/efootball-tracker.git
cd efootball-tracker
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Firebase project credentials in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Firebase Database Configuration
1. In the [Firebase Console](https://console.firebase.google.com/), navigate to **Build > Realtime Database**.
2. Click **Create Database**.
3. Under the **Rules** tab, set the rules to allow public read & write access:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
4. Click **Publish**.

### 5. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗑️ How to Clear Test Data from Firebase

To reset your database and clear all test players, matches, and tournaments:

### Method 1: Firebase Console (Quickest)
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project and click **Realtime Database**.
3. Hover over the root data node (or specific child nodes: `users`, `matches`, `tournaments`, `h2h`).
4. Click the **red "X" (Delete)** icon and confirm. Your database will instantly reset to empty.

---

## 🌐 Deployment to Vercel

1. Push your repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new) and import your repository.
3. In Environment Variables, add all 7 `NEXT_PUBLIC_FIREBASE_*` keys from your `.env.local`.
4. Click **Deploy**.

---

## 📄 License
MIT License
