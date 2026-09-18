import { auth, db } from './firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  deleteUser 
} from 'firebase/auth';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export const registerEmailUser = async (email, password, profileData) => {
  let user = null;

  try {
    // Moved inside try-catch to prevent fatal crashes if profileData is malformed
    const cleanUsername = profileData.username.trim().toLowerCase();
    
    // 1. FAST UX PRE-CHECK
    const usernameRef = doc(db, 'usernames', cleanUsername);
    const usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists()) {
      return { user: null, error: 'Username is already taken.' };
    }

    // 2. CREATE AUTH USER
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    user = userCredential.user;

    // 3. ATOMIC FIRESTORE BATCH
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', user.uid);
    
    // Strict schema matching firestore.rules
    const userData = {
      displayName: profileData.displayName.trim(),
      username: cleanUsername,
      gender: profileData.gender,
      photoURL: null, 
      bannerUrl: null,
      bubleText: '',
      bio: '',
      createdAt: serverTimestamp(),
      usernameLastChanged: null,
      socialStats: {
        friendsCount: 0,
        followersCount: 0,
        mutualFriends: 0,
        mutualServers: 0,
        serversJoined: 0
      }
    };

    batch.set(userRef, userData);
    batch.set(usernameRef, { uid: user.uid });

    // 4. COMMIT BATCH (Enforces rules atomically)
    await batch.commit();

    // 5. ISOLATED EMAIL VERIFICATION
    try {
      await sendEmailVerification(user);
    } catch (emailError) {
      console.warn('Email verification could not be sent immediately:', emailError);
    }

    return { user, error: null };
  } catch (error) {
    console.error('Registration Error:', error);
    
    // ROLLBACK: Delete auth account ONLY if Firestore batch or auth creation failed
    if (user) {
      try { 
        await deleteUser(user); 
      } catch (rollbackError) { 
        console.error('Rollback failed:', rollbackError); 
      }
    }
    
    return { user: null, error: error.message || 'Failed to create account.' };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    return { 
      user, 
      error: null, 
      unverified: !user.emailVerified 
    };
  } catch (error) {
    console.error('Login Error:', error);
    return { 
      user: null, 
      error: error.message || 'Failed to log in.', 
      unverified: false 
    };
  }
};
