import { useEffect, useState, useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const AUTH_STORAGE_KEY = 'drive_auth';

export const useDriveStore = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [isLocallyValid, setIsLocallyValid] = useState(false);

  const [request, , promptAsync] = Google.useAuthRequest({
    androidClientId: '1063333455169-9vms8ijn450afpf27ma36ed3cu08h7je.apps.googleusercontent.com',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  // Helper to wipe local credentials if Google returns a 401 or token expires
  const clearAuth = useCallback(async () => {
    setAccessToken(null);
    setIsLocallyValid(false);
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
  }, []);

  // Helper to persist auth payload immediately
  const persistAuth = useCallback(async (auth) => {
    const deathTime = Date.now() + auth.expiresIn * 1000;
    setAccessToken(auth.accessToken);
    setIsLocallyValid(true);

    await SecureStore.setItemAsync(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: auth.accessToken,
        expiresAt: deathTime,
      })
    );
  }, []);

  // Check stored credentials on mount
  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        const authData = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
        if (!authData) return;

        const { token, expiresAt } = JSON.parse(authData);
        if (Date.now() < expiresAt) {
          setAccessToken(token);
          setIsLocallyValid(true);
        } else {
          await clearAuth();
        }
      } catch (err) {
        console.warn('Failed to load stored auth:', err);
        await clearAuth();
      }
    };

    hydrateAuth();
  }, [clearAuth]);

  // Direct auth handler: saves immediately without waiting on React state
  const connectDrive = async () => {
    if (accessToken && isLocallyValid) {
      return accessToken;
    }

    const result = await promptAsync();
    if (result?.type === 'success' && result.authentication) {
      await persistAuth(result.authentication);
      return result.authentication.accessToken;
    }

    return null;
  };

  return {
    isReady: !!request,
    hasActiveSession: isLocallyValid,
    connectDrive,
    clearAuth,
  };
};

