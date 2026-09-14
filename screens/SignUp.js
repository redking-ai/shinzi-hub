import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, Modal, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { registerEmailUser } from '../authService';

export default function SignUp({ onBack }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Credentials (Email Only)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Identity (No Photo Picker)
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Validation Logic
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasNumber = /\d/.test(password);
  const isUsernameValid = username.length >= 3 && /^[a-zA-Z0-9_.-]+$/.test(username);

  const isValidDate = (d, m, y) => {
    const numD = parseInt(d, 10);
    const numM = parseInt(m, 10);
    const numY = parseInt(y, 10);
    const today = new Date();

    if (!numD || !numM || !numY || numM < 1 || numM > 12 || numY < 1920 || numY > today.getFullYear()) return false;

    const parsedDate = new Date(numY, numM - 1, numD);
    const isRealDate = parsedDate.getFullYear() === numY && parsedDate.getMonth() === numM - 1 && parsedDate.getDate() === numD;

    let age = today.getFullYear() - numY;
    if (today.getMonth() < numM - 1 || (today.getMonth() === numM - 1 && today.getDate() < numD)) age--;

    return isRealDate && age >= 13;
  };

  const isStep1Valid = isEmail && password.length >= 6 && hasNumber;
  const isStep2Valid = name.trim().length > 0 && isUsernameValid && isValidDate(day, month, year) && gender !== '';

  const executeSignUp = async () => {
    setIsSubmitting(true);
    try {
      const profileData = {
        name: name.trim(),
        username: username.trim(),
        gender,
        dob: `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`,
        profileImageUri: null, // Default avatar will be used in the app
      };

      const { user, error } = await registerEmailUser(email.trim(), password, profileData);
      
      if (error) {
        Alert.alert('Sign Up Failed', error);
      } else {
        Alert.alert('Account Created!', `Welcome to Shinzi Hub, ${profileData.name}!`);
        // Navigate to your main app screen here
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 1 ? onBack() : setStep(1)}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.stepText}>STEP {step}/2</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* STEP 1: Email & Password */}
        {step === 1 && (
          <View style={styles.content}>
            <View style={styles.inputBox}>
              <TextInput 
                style={styles.input} 
                placeholder="Email address" 
                placeholderTextColor="#8E8EA0" 
                value={email} 
                onChangeText={setEmail} 
                keyboardType="email-address" 
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
              style={[styles.continueBtn, !isStep1Valid && styles.disabledBtn]} 
              disabled={!isStep1Valid} 
              onPress={() => setStep(2)}
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Profile Setup */}
        {step === 2 && (
          <View style={styles.content}>
            
            {/* Static Avatar with Vector Icon */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={40} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.inputBox}>
              <TextInput style={styles.input} placeholder="Display Name" placeholderTextColor="#8E8EA0" value={name} onChangeText={setName} />
            </View>

            <View style={[styles.inputBox, username.length > 0 && !isUsernameValid && styles.errorBox]}>
              <TextInput style={styles.input} placeholder="Username (min 3 chars)" placeholderTextColor="#8E8EA0" value={username} onChangeText={setUsername} autoCapitalize="none" />
            </View>
            {username.length > 0 && !isUsernameValid && (
              <Text style={styles.errorText}>* Use letters, numbers, _, -, or . (at least 3 characters)</Text>
            )}

            <View style={styles.row}>
              <View style={[styles.inputBox, styles.flex1, { marginRight: 8 }]}>
                <TextInput style={styles.input} placeholder="DD" placeholderTextColor="#8E8EA0" maxLength={2} keyboardType="number-pad" value={day} onChangeText={setDay} />
              </View>
              <View style={[styles.inputBox, styles.flex1, { marginRight: 8 }]}>
                <TextInput style={styles.input} placeholder="MM" placeholderTextColor="#8E8EA0" maxLength={2} keyboardType="number-pad" value={month} onChangeText={setMonth} />
              </View>
              <View style={[styles.inputBox, styles.flex2]}>
                <TextInput style={styles.input} placeholder="YYYY" placeholderTextColor="#8E8EA0" maxLength={4} keyboardType="number-pad" value={year} onChangeText={setYear} />
              </View>
            </View>
            {(day.length > 0 || month.length > 0 || year.length > 0) && !isValidDate(day, month, year) && (
              <Text style={styles.errorText}>* Enter a valid calendar date (Min. age 13)</Text>
            )}

            <TouchableOpacity style={styles.inputBox} onPress={() => setShowGenderModal(true)}>
              <Text style={[styles.input, { color: gender ? '#FFFFFF' : '#8E8EA0', paddingTop: 18 }]}>
                {gender || 'Select Gender'} ▾
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.continueBtn, (!isStep2Valid || isSubmitting) && styles.disabledBtn]} 
              disabled={!isStep2Valid || isSubmitting} 
              onPress={executeSignUp}
            >
              <Text style={styles.continueText}>{isSubmitting ? 'Creating...' : 'Create Account'}</Text>
            </TouchableOpacity>
          </View>
        )}

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
  input: { flex: 1, color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 18, fontSize: 16 },
  errorText: { color: '#FF3366', fontSize: 13, marginTop: -8, marginBottom: 16, marginLeft: 4 },
  row: { flexDirection: 'row' },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#14141C', borderWidth: 2, borderColor: '#22222E', justifyContent: 'center', alignItems: 'center' },
  continueBtn: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  disabledBtn: { backgroundColor: '#333333', opacity: 0.5 },
  continueText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#14141C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalOption: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#22222E' },
  modalOptionText: { color: '#FFFFFF', fontSize: 18, textAlign: 'center' },
});
