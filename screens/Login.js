import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import {
  loginUser,
  sendPasswordReset
} from '../authService';

export default function Login({ onBack }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Login state
  const [loggingIn, setLoggingIn] = useState(false);

  // Password validation
  const hasNumber = /\d/.test(password);

  // ======================================================
  // LOGIN
  // ======================================================

  const handleFirebaseLogin = async () => {
    if (loggingIn) return;

    const email = identity.trim();

    if (!email) {
      Alert.alert('Login Failed', 'Please enter your email address.');
      return;
    }

    if (!password) {
      Alert.alert('Login Failed', 'Please enter your password.');
      return;
    }

    if (!hasNumber) {
      Alert.alert(
        'Login Failed',
        'Your password must contain at least 1 number.'
      );
      return;
    }

    try {
      setLoggingIn(true);

      const { user, error } = await loginUser(
        email,
        password
      );

      if (error) {
        Alert.alert('Login Failed', error);
        return;
      }

      if (!user) {
        Alert.alert(
          'Login Failed',
          'Firebase did not return a user account.'
        );
        return;
      }

      /*
       * IMPORTANT:
       *
       * We do NOT manually navigate to ChatScreen here.
       *
       * App.js is listening to Firebase's
       * onAuthStateChanged().
       *
       * Once Firebase authentication succeeds,
       * App.js automatically changes the screen
       * to ChatScreen.
       */

      Alert.alert(
        'Success',
        `Welcome back, ${user.email}!`
      );

    } catch (error) {
      console.error('Login error:', error);

      Alert.alert(
        'Login Failed',
        error?.message ||
          'Something went wrong while logging in.'
      );
    } finally {
      setLoggingIn(false);
    }
  };

  // ======================================================
  // FORGOT PASSWORD
  // ======================================================

  const handleSendReset = async () => {
    if (sendingReset) return;

    const email = resetEmail.trim();

    if (!email) {
      Alert.alert(
        'Invalid Email',
        'Please enter your registered email address.'
      );
      return;
    }

    if (!email.includes('@')) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    try {
      setSendingReset(true);

      const result = await sendPasswordReset(email);

      if (!result.success) {
        Alert.alert(
          'Reset Failed',
          result.error ||
            'Unable to send the password reset email.'
        );
        return;
      }

      setResetSent(true);

    } catch (error) {
      console.error(
        'Password reset error:',
        error
      );

      Alert.alert(
        'Reset Failed',
        error?.message ||
          'Unable to send the password reset email.'
      );

    } finally {
      setSendingReset(false);
    }
  };

  // ======================================================
  // CLOSE FORGOT PASSWORD MODAL
  // ======================================================

  const closeForgotModal = () => {
    if (sendingReset) return;

    setShowForgotModal(false);
    setResetSent(false);
    setResetEmail('');
  };

  // ======================================================
  // OPEN FORGOT PASSWORD MODAL
  // ======================================================

  const openForgotModal = () => {
    setResetSent(false);
    setResetEmail('');
    setShowForgotModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
      >

        {/* ==================================================
            HEADER
        ================================================== */}

        <View style={styles.header}>

          <TouchableOpacity
            onPress={onBack}
            disabled={loggingIn}
          >
            <Text style={styles.backText}>
              {'< Back'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.stepText}>
            LOG IN
          </Text>

          <View style={{ width: 50 }} />

        </View>

        {/* ==================================================
            CONTENT
        ================================================== */}

        <View style={styles.content}>

          {/* Email */}

          <View style={styles.inputBox}>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8E8EA0"
              value={identity}
              onChangeText={setIdentity}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loggingIn}
              returnKeyType="next"
            />

          </View>

          {/* Password */}

          <View style={styles.inputBox}>

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8E8EA0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loggingIn}
              returnKeyType="done"
              onSubmitEditing={
                identity &&
                password &&
                hasNumber
                  ? handleFirebaseLogin
                  : undefined
              }
            />

          </View>

          {/* Password number warning */}

          {password.length > 0 &&
            !hasNumber && (
              <Text style={styles.errorText}>
                * Password must contain at least 1 number
              </Text>
            )}

          {/* Forgot Password */}

          <TouchableOpacity
            onPress={openForgotModal}
            disabled={loggingIn}
          >
            <Text style={styles.forgotText}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Continue */}

          <TouchableOpacity
            style={[
              styles.continueBtn,

              (
                !identity ||
                !password ||
                !hasNumber ||
                loggingIn
              ) &&
                styles.disabledBtn
            ]}
            disabled={
              !identity ||
              !password ||
              !hasNumber ||
              loggingIn
            }
            onPress={handleFirebaseLogin}
          >

            <Text style={styles.continueText}>
              {loggingIn
                ? 'Logging in...'
                : 'Continue'}
            </Text>

          </TouchableOpacity>

        </View>

        {/* ==================================================
            FORGOT PASSWORD MODAL
        ================================================== */}

        <Modal
          visible={showForgotModal}
          transparent
          animationType="slide"
          onRequestClose={closeForgotModal}
        >

          <View style={styles.modalBg}>

            <View style={styles.modalContent}>

              {!resetSent ? (

                <>
                  <Text style={styles.modalTitle}>
                    Reset Password
                  </Text>

                  <Text style={styles.modalSub}>
                    Note: For password reset you will
                    get an email. You must verify your
                    email address to reset your password.
                  </Text>

                  {/* Reset email */}

                  <View style={styles.inputBox}>

                    <TextInput
                      style={styles.input}
                      placeholder="Enter your registered email"
                      placeholderTextColor="#8E8EA0"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!sendingReset}
                    />

                  </View>

                  {/* Send reset */}

                  <TouchableOpacity
                    style={[
                      styles.continueBtn,
                      (
                        !resetEmail ||
                        sendingReset
                      ) &&
                        styles.disabledBtn,
                      {
                        marginBottom: 10
                      }
                    ]}
                    disabled={
                      !resetEmail ||
                      sendingReset
                    }
                    onPress={handleSendReset}
                  >

                    <Text style={styles.continueText}>
                      {sendingReset
                        ? 'Sending...'
                        : 'Send Reset Link'}
                    </Text>

                  </TouchableOpacity>
                </>

              ) : (

                <>
                  <Text style={styles.modalTitle}>
                    Email Sent! ✉️
                  </Text>

                  <Text style={styles.modalSub}>
                    A password reset email has been
                    sent to the address you entered.
                    Check your inbox and follow the
                    instructions to reset your password.
                  </Text>
                </>

              )}

              {/* Close */}

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeForgotModal}
                disabled={sendingReset}
              >
                <Text style={styles.cancelText}>
                  Close
                </Text>
              </TouchableOpacity>

            </View>

          </View>

        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#000000'
  },

  flex1: {
    flex: 1
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30
  },

  backText: {
    color: '#00D2FF',
    fontSize: 16,
    fontWeight: '600'
  },

  stepText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20
  },

  inputBox: {
    backgroundColor: '#0D0D12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22222E',
    marginBottom: 16
  },

  input: {
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 16
  },

  errorText: {
    color: '#FF3366',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4
  },

  forgotText: {
    color: '#00D2FF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 30,
    marginLeft: 4
  },

  continueBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20
  },

  disabledBtn: {
    backgroundColor: '#333333',
    opacity: 0.7
  },

  continueText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700'
  },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end'
  },

  modalContent: {
    backgroundColor: '#14141C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center'
  },

  modalSub: {
    color: '#A5A5BA',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },

  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center'
  },

  cancelText: {
    color: '#8E8EA0',
    fontSize: 16,
    fontWeight: '600'
  }

});