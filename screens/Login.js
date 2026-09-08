import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, KeyboardAvoidingView, Platform, Modal 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function Login({ onBack }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Logic Checks
  const hasNumber = /\d/.test(password);

  const handleSendReset = () => {
    if (resetEmail.includes('@')) {
      setResetSent(true);
      // In the Firebase step, we will trigger the actual reset email here.
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetSent(false);
    setResetEmail('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.stepText}>LOG IN</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Email or Phone or Username"
              placeholderTextColor="#8E8EA0"
              value={identity}
              onChangeText={setIdentity}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8E8EA0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          
          {password.length > 0 && !hasNumber && (
            <Text style={styles.errorText}>* Password must contain at least 1 number</Text>
          )}

          <TouchableOpacity onPress={() => setShowForgotModal(true)}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.continueBtn, (!identity || !password || !hasNumber) && styles.disabledBtn]} 
            disabled={!identity || !password || !hasNumber}
            onPress={() => console.log('Log In Attempted')}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {/* Forgot Password Bottom Modal */}
        <Modal visible={showForgotModal} transparent animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>
              
              {!resetSent ? (
                <>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSub}>Note: For password reset you will get only an email! Must need to verify email.</Text>
                  
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your registered email"
                      placeholderTextColor="#8E8EA0"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <TouchableOpacity 
                    style={[styles.continueBtn, !resetEmail && styles.disabledBtn, { marginBottom: 10 }]} 
                    disabled={!resetEmail}
                    onPress={handleSendReset}
                  >
                    <Text style={styles.continueText}>Send Reset Link</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Email Sent! ✉️</Text>
                  <Text style={styles.modalSub}>You got an email to reset your password. Check your inbox.</Text>
                </>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={closeForgotModal}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  backText: { color: '#00D2FF', fontSize: 16, fontWeight: '600' },
  stepText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  inputBox: { backgroundColor: '#0D0D12', borderRadius: 12, borderWidth: 1, borderColor: '#22222E', marginBottom: 16 },
  input: { color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 18, fontSize: 16 },
  errorText: { color: '#FF3366', fontSize: 13, marginTop: -8, marginBottom: 16, marginLeft: 4 },
  forgotText: { color: '#00D2FF', fontSize: 14, fontWeight: '600', marginBottom: 30, marginLeft: 4 },
  continueBtn: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  disabledBtn: { backgroundColor: '#333333', opacity: 0.7 },
  continueText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  
  /* Modal Styles */
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#14141C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalSub: { color: '#A5A5BA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelText: { color: '#8E8EA0', fontSize: 16, fontWeight: '600' }
});
