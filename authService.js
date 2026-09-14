import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  deleteUser,
  sendEmailVerification
} from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore"; 
import { auth, db } from "./firebaseConfig";

export const registerEmailUser = async (email, password, profileData) => {
  try {
    // 1. Check Username Uniqueness
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', profileData.username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { user: null, error: "Username is already taken. Please choose another." };
    }

    // 2. Create the Firebase Auth Account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 3. Save Profile to Firestore (With strict rollback)
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: profileData.name,
        username: profileData.username,
        gender: profileData.gender,
        dob: profileData.dob,
        profileImageUri: null, 
        createdAt: serverTimestamp(), 
      });
    } catch (firestoreError) {
      try {
        await deleteUser(user);
        return { user: null, error: "Failed to save profile. Account creation was safely rolled back." };
      } catch (rollbackError) {
        return { user: null, error: "Critical error: Profile failed to save and account rollback failed. Please contact support." };
      }
    }

    // 4. Send Email Verification (Non-destructive)
    try {
      await sendEmailVerification(user);
    } catch (emailError) {
      console.warn("Account created, but email verification failed to send:", emailError);
      // We DO NOT rollback here. The account and database are perfectly valid.
    }

    return { user, error: null };

  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Pass a flag to the UI if the email isn't verified yet
    if (!user.emailVerified) {
      return { user, error: null, unverified: true };
    }
    
    return { user, error: null, unverified: false };
  } catch (error) {
    return { user: null, error: error.message };
  }
};
