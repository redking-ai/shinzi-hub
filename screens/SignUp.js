import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { registerEmailUser } from '../authService';
import { useDriveStore } from '../store';

export default function SignUp({ onBack }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Drive connection
  const {
    isReady: isDriveReady,
    connectDrive
  } = useDriveStore();

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [profileImage, setProfileImage] = useState(null);

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  const normalizedUsername =
    username.trim().toLowerCase();

  const isEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim()
    );

  const hasNumber =
    /\d/.test(password);

  // MUST match Firestore rules
  const isUsernameValid =
    /^[a-z0-9_]{3,15}$/.test(
      normalizedUsername
    );

  const isValidDate = (d, m, y) => {
    const numD = parseInt(d, 10);
    const numM = parseInt(m, 10);
    const numY = parseInt(y, 10);

    const today = new Date();

    if (
      !numD ||
      !numM ||
      !numY ||
      numM < 1 ||
      numM > 12 ||
      numY < 1920 ||
      numY > today.getFullYear()
    ) {
      return false;
    }

    const parsedDate = new Date(
      numY,
      numM - 1,
      numD
    );

    const isRealDate =
      parsedDate.getFullYear() === numY &&
      parsedDate.getMonth() === numM - 1 &&
      parsedDate.getDate() === numD;

    let age =
      today.getFullYear() - numY;

    if (
      today.getMonth() < numM - 1 ||
      (
        today.getMonth() === numM - 1 &&
        today.getDate() < numD
      )
    ) {
      age--;
    }

    return (
      isRealDate &&
      age >= 13
    );
  };

  const isStep1Valid =
    isEmail &&
    password.length >= 6 &&
    hasNumber;

  const isStep2Valid =
    profileImage !== null &&
    name.trim().length > 0 &&
    isUsernameValid &&
    isValidDate(
      day,
      month,
      year
    ) &&
    gender !== '';

  // --------------------------------------------------
  // AVATAR PICKER
  // --------------------------------------------------

  const handleAvatarPress = async () => {
    if (isSubmitting) {
      return;
    }

    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

      if (
        !result.canceled &&
        result.assets &&
        result.assets.length > 0
      ) {
        setProfileImage(
          result.assets[0].uri
        );
      }
    } catch (err) {
      console.error(
        'Image picker error:',
        err
      );

      Alert.alert(
        'Error',
        'Unable to access gallery.'
      );
    }
  };

  // --------------------------------------------------
  // CREATE ACCOUNT
  // --------------------------------------------------

  const executeSignUp = async () => {
    if (isSubmitting) {
      return;
    }

    // Profile photo is required
    if (!profileImage) {
      Alert.alert(
        'Profile Photo Required',
        'Please select a profile photo before creating your account.'
      );
      return;
    }

    // Google Drive OAuth must be ready
    if (!isDriveReady) {
      Alert.alert(
        'Google Drive Not Ready',
        'Please wait a moment and try again.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // ------------------------------------------------
      // GOOGLE DRIVE PERMISSION
      // ------------------------------------------------

      const driveToken =
        await connectDrive();

      // User denied/cancelled Google permission
      if (!driveToken) {
        Alert.alert(
          'Google Drive Permission Required',
          'Shinzi requires Google Drive permission to continue creating your account.'
        );

        return;
      }

      // ------------------------------------------------
      // CREATE FIREBASE ACCOUNT
      // ------------------------------------------------

      const profileData = {
        displayName:
          name.trim(),

        username:
          normalizedUsername,

        gender,

        dob:
          `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`,

        // Local image URI for now.
        // The actual Drive upload pipeline
        // will be connected later.
        profileImageUri:
          profileImage,
      };

      const {
        user,
        error
      } = await registerEmailUser(
        email.trim(),
        password,
        profileData
      );

      if (error) {
        Alert.alert(
          'Sign Up Failed',
          error
        );

        return;
      }

      if (user) {
        Alert.alert(
          'Account Created!',
          `Welcome to Shinzi Hub, ${profileData.displayName}! Please check your email inbox to verify your account.`
        );

        return;
      }

      Alert.alert(
        'Sign Up Failed',
        'Account creation did not complete. Please try again.'
      );

    } catch (err) {
      console.error(
        'Signup error:',
        err
      );

      Alert.alert(
        'Error',
        err?.message ||
          'An unexpected error occurred during signup.'
      );

    } finally {
      setIsSubmitting(false);
    }
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

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              step === 1
                ? onBack()
                : setStep(1)
            }
            disabled={isSubmitting}
          >
            <Text style={styles.backText}>
              {'< Back'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.stepText}>
            STEP {step}/2
          </Text>

          <View
            style={{
              width: 50
            }}
          />
        </View>

        {/* STEP 1 */}
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
                autoCorrect={false}
                editable={!isSubmitting}
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
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>

            {password.length > 0 &&
              !hasNumber && (
                <Text style={styles.errorText}>
                  * Password must contain at least 1 number
                </Text>
              )}

            <TouchableOpacity
              style={[
                styles.continueBtn,
                !isStep1Valid &&
                  styles.disabledBtn
              ]}
              disabled={
                !isStep1Valid ||
                isSubmitting
              }
              onPress={() =>
                setStep(2)
              }
            >
              <Text style={styles.continueText}>
                Continue
              </Text>
            </TouchableOpacity>

          </View>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <View style={styles.content}>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                style={styles.avatarCircle}
                onPress={handleAvatarPress}
                disabled={isSubmitting}
              >
                {profileImage ? (
                  <Image
                    source={{
                      uri: profileImage
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={40}
                    color="#FFFFFF"
                  />
                )}

                <View style={styles.pencilBadge}>
                  <Ionicons
                    name="pencil"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              </TouchableOpacity>

              {!profileImage && (
                <Text
                  style={styles.photoRequiredText}
                >
                  Profile photo required
                </Text>
              )}
            </View>

            {/* Display Name */}
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor="#8E8EA0"
                value={name}
                onChangeText={setName}
                maxLength={50}
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>

            {/* Username */}
            <View
              style={[
                styles.inputBox,
                username.length > 0 &&
                  !isUsernameValid &&
                  styles.errorBox
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Username (3-15 chars)"
                placeholderTextColor="#8E8EA0"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
                editable={!isSubmitting}
              />
            </View>

            {username.length > 0 &&
              !isUsernameValid && (
                <Text style={styles.errorText}>
                  * 3-15 characters, lowercase letters, numbers, and underscores only
                </Text>
              )}

            {/* Date of Birth */}
            <View style={styles.row}>

              <View
                style={[
                  styles.inputBox,
                  styles.flex1,
                  {
                    marginRight: 8
                  }
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="DD"
                  placeholderTextColor="#8E8EA0"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={day}
                  onChangeText={setDay}
                  editable={!isSubmitting}
                />
              </View>

              <View
                style={[
                  styles.inputBox,
                  styles.flex1,
                  {
                    marginRight: 8
                  }
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="MM"
                  placeholderTextColor="#8E8EA0"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={month}
                  onChangeText={setMonth}
                  editable={!isSubmitting}
                />
              </View>

              <View
                style={[
                  styles.inputBox,
                  styles.flex2
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="YYYY"
                  placeholderTextColor="#8E8EA0"
                  maxLength={4}
                  keyboardType="number-pad"
                  value={year}
                  onChangeText={setYear}
                  editable={!isSubmitting}
                />
              </View>

            </View>

            {(day.length > 0 ||
              month.length > 0 ||
              year.length > 0) &&
              !isValidDate(
                day,
                month,
                year
              ) && (
                <Text style={styles.errorText}>
                  * Enter a valid calendar date (Min. age 13)
                </Text>
              )}

            {/* Gender */}
            <TouchableOpacity
              style={[
                styles.inputBox,
                {
                  alignItems: 'center',
                  paddingRight: 16
                }
              ]}
              onPress={() =>
                setShowGenderModal(true)
              }
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.input,
                  {
                    color: gender
                      ? '#FFFFFF'
                      : '#8E8EA0'
                  }
                ]}
              >
                {gender ||
                  'Select Gender'}
              </Text>

              <Ionicons
                name="chevron-down"
                size={20}
                color="#8E8EA0"
              />
            </TouchableOpacity>

            {/* Create Account */}
            <TouchableOpacity
              style={[
                styles.continueBtn,
                (
                  !isStep2Valid ||
                  isSubmitting
                ) &&
                  styles.disabledBtn
              ]}
              disabled={
                !isStep2Valid ||
                isSubmitting
              }
              onPress={executeSignUp}
            >
              <Text style={styles.continueText}>
                {isSubmitting
                  ? 'Creating...'
                  : 'Create Account'}
              </Text>
            </TouchableOpacity>

          </View>
        )}

        {/* Gender Modal */}
        <Modal
          visible={showGenderModal}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowGenderModal(false)
          }
        >
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>

              {[
                'Male',
                'Female',
                'Others'
              ].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={styles.modalOption}
                  onPress={() => {
                    setGender(g);
                    setShowGenderModal(false);
                  }}
                >
                  <Text
                    style={styles.modalOptionText}
                  >
                    {g}
                  </Text>
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
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },

  flex1: {
    flex: 1
  },

  flex2: {
    flex: 2
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20
  },

  backText: {
    color: '#00D2FF',
    fontSize: 16,
    fontWeight: '600'
  },

  stepText: {
    color: '#8E8EA0',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1
  },

  content: {
    flex: 1,
    paddingHorizontal: 24
  },

  inputBox: {
    flexDirection: 'row',
    backgroundColor: '#0D0D12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22222E',
    marginBottom: 16,
    overflow: 'hidden'
  },

  errorBox: {
    borderColor: '#FF3366'
  },

  input: {
    flex: 1,
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

  photoRequiredText: {
    color: '#FF3366',
    fontSize: 12,
    marginTop: 8
  },

  row: {
    flexDirection: 'row'
  },

  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24
  },

  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#14141C',
    borderWidth: 2,
    borderColor: '#22222E',
    justifyContent: 'center',
    alignItems: 'center'
  },

  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43
  },

  pencilBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#8A2BE2',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000'
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
    opacity: 0.5
  },

  continueText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700'
  },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },

  modalContent: {
    backgroundColor: '#14141C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24
  },

  modalOption: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#22222E'
  },

  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center'
  }
});