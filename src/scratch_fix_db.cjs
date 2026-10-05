const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update } = require('firebase/database');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function run() {
  console.log('--- REPAIRING FIREBASE DATABASE ---');
  const usersSnap = await get(ref(db, 'users'));
  const matchesSnap = await get(ref(db, 'matches'));
  const tournamentsSnap = await get(ref(db, 'tournaments'));

  const users = usersSnap.val() || {};
  const matches = matchesSnap.val() || {};
  const tournaments = tournamentsSnap.val() || {};

  const updates = {};

  // 1. Fix match records where player2Id is Ashu (-P3Bm-18sm767CtVZKtv) but player2Name was saved as Vansh
  for (const [mId, m] of Object.entries(matches)) {
    if (m.player2Id === '-P3Bm-18sm767CtVZKtv' && m.player2Name !== 'Ashu') {
      console.log(`Fixing match ${mId}: player2Name was ${m.player2Name}, setting to Ashu`);
      updates[`matches/${mId}/player2Name`] = 'Ashu';
      if (m.winnerId === '-P3Bm-18sm767CtVZKtv') {
        updates[`matches/${mId}/winnerName`] = 'Ashu';
      }
      if (m.loserId === '-P3Bm-18sm767CtVZKtv') {
        updates[`matches/${mId}/loserName`] = 'Ashu';
      }
    }
  }

  // 2. Fix tournament bracket records where player2Id is Ashu (-P3Bm-18sm767CtVZKtv) but player2Name was saved as Vansh
  for (const [tId, t] of Object.entries(tournaments)) {
    if (t.bracket?.thirdPlace) {
      const tp = t.bracket.thirdPlace;
      if (tp.player2Id === '-P3Bm-18sm767CtVZKtv' && tp.player2Name !== 'Ashu') {
        console.log(`Fixing tournament ${tId} thirdPlace: player2Name was ${tp.player2Name}, setting to Ashu`);
        updates[`tournaments/${tId}/bracket/thirdPlace/player2Name`] = 'Ashu';
      }
      if (t.standings?.third === '-P3Bm-18sm767CtVZKtv') {
        // Ensure standings.third is correct
        updates[`tournaments/${tId}/standings/third`] = '-P3Bm-18sm767CtVZKtv';
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    console.log('Applying updates:', JSON.stringify(updates, null, 2));
    await update(ref(db), updates);
    console.log('Database successfully repaired!');
  } else {
    console.log('No database repairs needed.');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
