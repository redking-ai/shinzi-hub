import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from './firebaseConfig';

// Screens
import SignUp from './screens/SignUp';
import Login from './screens/Login';
import ChatScreen from './screens/ChatScreen';


// ============================================================
// APP
// ============================================================

export default function App() {

  // ----------------------------------------------------------
  // AUTHENTICATION STATE
  // ----------------------------------------------------------

  const [user, setUser] = useState(null);

  const [authLoading, setAuthLoading] =
    useState(true);


  // ----------------------------------------------------------
  // LOCAL SCREEN STATE
  //
  // This is ONLY used while the user is logged out.
  // ----------------------------------------------------------

  const [currentScreen, setCurrentScreen] =
    useState('welcome');


  // ==========================================================
  // FIREBASE AUTH STATE LISTENER
  // ==========================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {

          setUser(firebaseUser);

          setAuthLoading(false);

          /*
           * If Firebase says a user is authenticated,
           * there is no reason to keep showing the
           * welcome/login/signup screen.
           */
          if (firebaseUser) {
            setCurrentScreen('chat');
          }

          /*
           * If the user logs out, return to the
           * welcome screen.
           */
          else {
            setCurrentScreen('welcome');
          }
        }
      );


    // Cleanup Firebase listener
    return unsubscribe;

  }, []);


  // ==========================================================
  // AUTH LOADING
  // ==========================================================

  /*
   * Firebase needs a moment to determine whether an
   * existing authentication session is still valid.
   *
   * We don't want to briefly show the Welcome screen
   * before sending an already-logged-in user to Chat.
   */

  if (authLoading) {

    return (
      <View style={styles.loadingContainer}>

        <StatusBar style="light" />

        <ActivityIndicator
          size="large"
          color="#00D2FF"
        />

      </View>
    );
  }


  // ==========================================================
  // AUTHENTICATED USER
  // ==========================================================

  /*
   * THIS IS THE IMPORTANT PART.
   *
   * If Firebase has an authenticated user,
   * ChatScreen becomes the root screen.
   *
   * This works for:
   *
   * 1. New signup
   * 2. Successful login
   * 3. Existing session after reopening the app
   */

  if (user) {

    return (
      <ChatScreen />
    );
  }


  // ==========================================================
  // SIGN UP
  // ==========================================================

  if (currentScreen === 'signup') {

    return (
      <SignUp
        onBack={() =>
          setCurrentScreen('welcome')
        }
      />
    );
  }


  // ==========================================================
  // LOGIN
  // ==========================================================

  if (currentScreen === 'login') {

    return (
      <Login
        onBack={() =>
          setCurrentScreen('welcome')
        }
      />
    );
  }


  // ==========================================================
  // WELCOME SCREEN
  // ==========================================================

  return (
    <View style={styles.container}>

      <StatusBar style="light" />

      <ImageBackground
        source={require('./assets/background.png')}
        style={styles.background}
        resizeMode="cover"
      >

        <SafeAreaView style={styles.safeArea}>

          {/* ==================================================
              HEADER & HERO
          ================================================== */}

          <View style={styles.heroSection}>

            <Image
              source={require('./assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              WELCOME TO{'\n'}SHINZI HUB
            </Text>

            <Text style={styles.description}>
              Join servers, search or chat.{'\n'}
              Tap below To Get started!
            </Text>

          </View>


          {/* ==================================================
              ACTION BUTTONS
          ================================================== */}

          <View style={styles.actionSection}>

            <Text style={styles.helperText}>
              if you are new
            </Text>


            <TouchableOpacity
              style={styles.signUpButton}
              activeOpacity={0.8}
              onPress={() =>
                setCurrentScreen('signup')
              }
            >

              <Text style={styles.signUpButtonText}>
                Sign up
              </Text>

            </TouchableOpacity>


            <Text
              style={[
                styles.helperText,
                {
                  marginTop: 14
                }
              ]}
            >
              if you already have account
            </Text>


            <TouchableOpacity
              style={styles.logInButton}
              activeOpacity={0.8}
              onPress={() =>
                setCurrentScreen('login')
              }
            >

              <Text style={styles.logInButtonText}>
                Log in
              </Text>

            </TouchableOpacity>

          </View>

        </SafeAreaView>

      </ImageBackground>

    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  heroSection: {
    alignItems: 'center',
    marginTop: 40,
  },

  logo: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 34,
  },

  description: {
    color: '#A5A5BA',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    fontWeight: '400',
  },

  actionSection: {
    width: '100%',
    marginBottom: 20,
  },

  helperText: {
    color: '#8E8EA0',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '500',
  },

  signUpButton: {
    backgroundColor: 'rgba(10, 10, 14, 0.75)',
    borderWidth: 1,
    borderColor: '#2E2E42',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },

  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  logInButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },

  logInButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

});