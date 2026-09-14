import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; 
import { auth, db } from "./firebaseConfig"; // Added 'db' for Firestore

export const registerEmailUser = async (email, password, profileData) => {
  try {
    // 1. Create the account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save the profile data to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name: profileData.name,
      username: profileData.username,
      gender: profileData.gender,
      dob: profileData.dob,
      profileImageUri: profileData.profileImageUri,
      createdAt: new Date().toISOString(),
    });

    return { user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};
