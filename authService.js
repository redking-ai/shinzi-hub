import { auth, db } from './firebaseConfig';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  deleteUser
} from 'firebase/auth';

import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

export const registerEmailUser = async (
  email,
  password,
  profileData
) => {
  let user = null;

  try {
    // --------------------------------------------------
    // VALIDATE PROFILE DATA
    // --------------------------------------------------

    if (!profileData) {
      return {
        user: null,
        error: 'Profile information is missing.'
      };
    }

    if (
      !profileData.displayName ||
      !profileData.username ||
      !profileData.gender
    ) {
      return {
        user: null,
        error: 'Required profile information is missing.'
      };
    }

    // --------------------------------------------------
    // NORMALIZE USERNAME
    // --------------------------------------------------

    const cleanUsername =
      profileData.username
        .trim()
        .toLowerCase();

    // --------------------------------------------------
    // FAST USERNAME PRE-CHECK
    // --------------------------------------------------

    const usernameRef =
      doc(
        db,
        'usernames',
        cleanUsername
      );

    const usernameSnap =
      await getDoc(usernameRef);

    if (usernameSnap.exists()) {
      return {
        user: null,
        error: 'Username is already taken.'
      };
    }

    // --------------------------------------------------
    // CREATE FIREBASE AUTH USER
    // --------------------------------------------------

    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

    user =
      userCredential.user;

    // --------------------------------------------------
    // CREATE FIRESTORE BATCH
    // --------------------------------------------------

    const batch =
      writeBatch(db);

    const userRef =
      doc(
        db,
        'users',
        user.uid
      );

    // --------------------------------------------------
    // USER PROFILE DATA
    // --------------------------------------------------

    const userData = {
      displayName:
        profileData.displayName.trim(),

      username:
        cleanUsername,

      gender:
        profileData.gender,

      // Profile image system
      //
      // This remains null until the real
      // Google Drive upload / Shinzi asset
      // system is implemented.
      photoURL: null,

      profileDriveFileId:
        profileData.profileDriveFileId ||
        null,

      bannerUrl: null,

      bubleText: '',

      bio: '',

      createdAt:
        serverTimestamp(),

      usernameLastChanged:
        null,

      socialStats: {
        friendsCount: 0,
        followersCount: 0,
        mutualFriends: 0,
        mutualServers: 0,
        serversJoined: 0
      }
    };

    // --------------------------------------------------
    // FIRESTORE WRITES
    // --------------------------------------------------

    batch.set(
      userRef,
      userData
    );

    batch.set(
      usernameRef,
      {
        uid: user.uid
      }
    );

    // --------------------------------------------------
    // COMMIT
    // --------------------------------------------------

    await batch.commit();

    // --------------------------------------------------
    // EMAIL VERIFICATION
    // --------------------------------------------------

    try {
      await sendEmailVerification(
        user
      );
    } catch (emailError) {
      console.warn(
        'Email verification could not be sent immediately:',
        emailError
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return {
      user,
      error: null
    };

  } catch (error) {
    console.error(
      'Registration Error:',
      error
    );

    // --------------------------------------------------
    // AUTH ROLLBACK
    // --------------------------------------------------

    if (user) {
      try {
        await deleteUser(user);
      } catch (rollbackError) {
        console.error(
          'Auth rollback failed:',
          rollbackError
        );
      }
    }

    return {
      user: null,
      error:
        error?.message ||
        'Failed to create account.'
    };
  }
};

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------

export const loginUser = async (
  email,
  password
) => {
  try {
    const userCredential =
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

    const user =
      userCredential.user;

    return {
      user,
      error: null,
      unverified:
        !user.emailVerified
    };

  } catch (error) {
    console.error(
      'Login Error:',
      error
    );

    return {
      user: null,
      error:
        error?.message ||
        'Failed to log in.',

      unverified: false
    };
  }
};