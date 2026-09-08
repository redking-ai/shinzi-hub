import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, Modal, FlatList, KeyboardAvoidingView, Platform 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const countries = [
  { label: '🇺🇸 +1 (United States)', value: '+1' },
  { label: '🇨🇦 +1 (Canada)', value: '+1' },
  { label: '🇬🇧 +44 (United Kingdom)', value: '+44' },
  { label: '🇮🇳 +91 (India)', value: '+91' },
  { label: '🇧🇩 +880 (Bangladesh)', value: '+880' },
  { label: '🇦🇺 +61 (Australia)', value: '+61' },
  { label: '🇩🇪 +49 (Germany)', value: '+49' },
  { label: '🇫🇷 +33 (France)', value: '+33' },
  { label: '🇯🇵 +81 (Japan)', value: '+81' },
  { label: '🇰🇷 +82 (South Korea)', value: '+82' },
  { label: '🇨🇳 +86 (China)', value: '+86' },
  { label: '🇸🇬 +65 (Singapore)', value: '+65' },
  { label: '🇧🇷 +55 (Brazil)', value: '+55' },
  { label: '🇲🇽 +52 (Mexico)', value: '+52' },
  { label: '🇦🇷 +54 (Argentina)', value: '+54' },
  { label: '🇿🇦 +27 (South Africa)', value: '+27' },
  { label: '🇳🇬 +234 (Nigeria)', value: '+234' },
  { label: '🇪🇬 +20 (Egypt)', value: '+20' },
  { label: '🇸🇦 +966 (Saudi Arabia)', value: '+966' },
  { label: '🇦🇪 +971 (UAE)', value: '+971' },
  { label: '🇮🇹 +39 (Italy)', value: '+39' },
  { label: '🇪🇸 +34 (Spain)', value: '+34' },
  { label: '🇷🇺 +7 (Russia)', value: '+7' },
  { label: '🌐 +00 (Other)', value: '+' }, // Catch-all for unlisted countries
];


export default function SignUp({ onBack }) {
  const [step, setStep] = useState(1);

  // Step 1
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [showCountryModal, setShowCountryModal] = useState(false);

  // Step 2
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('Male');
  const [showGenderModal, setShowGenderModal] = useState(false);

  // Logic Checks
  const isPhone = /^\d/.test(contact); 
  const hasNumber = /\d/.test(password);
  const isUsernameValid = username.length === 0 || /^[a-zA-Z0-9_.-]+$/.test(username);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 1 ? onBack() : setStep(step - 1)}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.stepText}>STEP {step}/3</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* STEP 1: Credentials */}
        {step === 1 && (
          <View style={styles.content}>
            <View style={styles.inputBox}>
              {isPhone && (
                <TouchableOpacity style={styles.prefixButton} onPress={() => setShowCountryModal(true)}>
                  <Text style={styles.prefixText}>{countryCode} ▾</Text>
                </TouchableOpacity>
              )}
              <TextInput
                style={styles.input}
                placeholder="Email or Phone number"
                placeholderTextColor="#8E8EA0"
                value={contact}
                onChangeText={setContact}
                keyboardType={isPhone ? 'phone-pad' : 'email-address'}
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

            <TouchableOpacity 
              style={[styles.continueBtn, (!contact || !password || !hasNumber) && styles.disabledBtn]} 
              disabled={!contact || !password || !hasNumber}
              onPress={() => setStep(2)}
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Identity */}
        {step === 2 && (
          <View style={styles.content}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity style={styles.avatarCircle}>
                <Text style={styles.avatarIcon}>👤</Text>
                <View style={styles.pencilBadge}>
                  <Text style={styles.pencilText}>✎</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.inputBox}>
              <TextInput style={styles.input} placeholder="Display Name" placeholderTextColor="#8E8EA0" value={name} onChangeText={setName} />
            </View>

            <View style={[styles.inputBox, !isUsernameValid && styles.errorBox]}>
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#8E8EA0" value={username} onChangeText={setUsername} autoCapitalize="none" />
            </View>
            {!isUsernameValid && <Text style={styles.errorText}>* Invalid characters. Use letters, numbers, _, -, or .</Text>}

            <View style={styles.row}>
              <View style={[styles.inputBox, styles.flex1, { marginRight: 8 }]}>
                <TextInput style={styles.input} placeholder="DD" placeholderTextColor="#8E8EA0" maxLength={2} keyboardType="number-pad" />
              </View>
              <View style={[styles.inputBox, styles.flex1, { marginRight: 8 }]}>
                <TextInput style={styles.input} placeholder="MM" placeholderTextColor="#8E8EA0" maxLength={2} keyboardType="number-pad" />
              </View>
              <View style={[styles.inputBox, styles.flex2]}>
                <TextInput style={styles.input} placeholder="YYYY" placeholderTextColor="#8E8EA0" maxLength={4} keyboardType="number-pad" />
              </View>
            </View>

            <TouchableOpacity style={styles.inputBox} onPress={() => setShowGenderModal(true)}>
              <Text style={[styles.input, { color: gender ? '#FFFFFF' : '#8E8EA0', paddingTop: 18 }]}>
                {gender || 'Gender'} ▾
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueBtn} onPress={() => setStep(3)}>
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Verification */}
        {step === 3 && (
          <View style={styles.content}>
            <Text style={styles.verifySubtitle}>We sent a code to{'\n'}{contact}</Text>
            
            <View style={styles.otpRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.otpBox}>
                  <TextInput style={styles.otpInput} maxLength={1} keyboardType="number-pad" />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.resendBtn}>
              <Text style={styles.resendText}>Resend Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueBtn} onPress={() => console.log('Account Created')}>
              <Text style={styles.continueText}>Verify & Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Modals for Dropdowns */}
        <Modal visible={showCountryModal} transparent animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>
              {countries.map(c => (
                <TouchableOpacity key={c.value} style={styles.modalOption} onPress={() => { setCountryCode(c.value); setShowCountryModal(false); }}>
                  <Text style={styles.modalOptionText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <Modal visible={showGenderModal} transparent animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>
              {['Male', 'Female', 'Others'].map(g => (
                <TouchableOpacity key={g} style={styles.modalOption} onPress={() => { setGender(g); setShowGenderModal(false); }}>
                  <Text style={styles.modalOptionText}>{g}</Text>
                </TouchableOpacity>
              ))}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  backText: { color: '#00D2FF', fontSize: 16, fontWeight: '600' },
  stepText: { color: '#8E8EA0', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  inputBox: { flexDirection: 'row', backgroundColor: '#0D0D12', borderRadius: 12, borderWidth: 1, borderColor: '#22222E', marginBottom: 16, overflow: 'hidden' },
  errorBox: { borderColor: '#FF3366' },
  prefixButton: { paddingHorizontal: 16, justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#22222E', backgroundColor: '#14141C' },
  prefixText: { color: '#00D2FF', fontSize: 16, fontWeight: '600' },
  input: { flex: 1, color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 18, fontSize: 16 },
  errorText: { color: '#FF3366', fontSize: 13, marginTop: -8, marginBottom: 16, marginLeft: 4 },
  row: { flexDirection: 'row' },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#14141C', borderWidth: 2, borderColor: '#22222E', justifyContent: 'center', alignItems: 'center' },
  avatarIcon: { fontSize: 34 },
  pencilBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#8A2BE2', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000000' },
  pencilText: { color: '#FFFFFF', fontSize: 14 },
  verifySubtitle: { color: '#8E8EA0', textAlign: 'center', fontSize: 16, marginBottom: 32 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  otpBox: { width: 65, height: 75, backgroundColor: '#0D0D12', borderRadius: 12, borderWidth: 1, borderColor: '#22222E', justifyContent: 'center', alignItems: 'center' },
  otpInput: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  resendBtn: { backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 28, borderWidth: 1, borderColor: '#22222E', marginBottom: 16, alignItems: 'center' },
  resendText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  continueBtn: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  disabledBtn: { backgroundColor: '#333333', opacity: 0.7 },
  continueText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#14141C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalOption: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#22222E' },
  modalOptionText: { color: '#FFFFFF', fontSize: 18, textAlign: 'center' },
});

