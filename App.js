import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Import your new screens
import SignUp from './screens/SignUp';
import Login from './screens/Login';

export default function App() {
  // This state controls which screen is visible ('welcome', 'signup', or 'login')
  const [currentScreen, setCurrentScreen] = useState('welcome');

  // Routing Logic: If the state changes, show the corresponding screen
  if (currentScreen === 'signup') {
    return <SignUp onBack={() => setCurrentScreen('welcome')} />;
  }

  if (currentScreen === 'login') {
    return <Login onBack={() => setCurrentScreen('welcome')} />;
  }

  // Default: Show the Welcome Screen
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('./assets/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header & Hero Area */}
          <View style={styles.heroSection}>
            <Image
              source={require('./assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>WELCOME TO{'\n'}SHINZI HUB</Text>
            <Text style={styles.description}>
              Join servers, search or chat.{'\n'}Tap below To Get started!
            </Text>
          </View>

          {/* Action Buttons Section */}
          <View style={styles.actionSection}>
            <Text style={styles.helperText}>if you are new</Text>
            <TouchableOpacity
              style={styles.signUpButton}
              activeOpacity={0.8}
              onPress={() => setCurrentScreen('signup')}
            >
              <Text style={styles.signUpButtonText}>Sign up</Text>
            </TouchableOpacity>

            <Text style={[styles.helperText, { marginTop: 14 }]}>
              if you already have account
            </Text>
            <TouchableOpacity
              style={styles.logInButton}
              activeOpacity={0.8}
              onPress={() => setCurrentScreen('login')}
            >
              <Text style={styles.logInButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
