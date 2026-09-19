import { useEffect, useState, useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const AUTH_STORAGE_KEY = 'drive_auth';

export const useDriveStore = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [isLocallyValid, setIsLocallyValid] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [request, , promptAsync] =
    Google.useAuthRequest({
      androidClientId:
        '1063333455169-9vms8ijn450afpf27ma36ed3cu08h7je.apps.googleusercontent.com',

      scopes: [
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

  // --------------------------------------------------
  // CLEAR GOOGLE DRIVE AUTH
  // --------------------------------------------------

  const clearAuth = useCallback(async () => {
    setAccessToken(null);
    setIsLocallyValid(false);

    try {
      await SecureStore.deleteItemAsync(
        AUTH_STORAGE_KEY
      );
    } catch (err) {
      console.warn(
        'Failed to clear stored Drive auth:',
        err
      );
    }
  }, []);

  // --------------------------------------------------
  // SAVE GOOGLE AUTH
  // --------------------------------------------------

  const persistAuth = useCallback(async (auth) => {
    if (!auth?.accessToken) {
      throw new Error(
        'Google authentication did not return an access token.'
      );
    }

    const expiresInSeconds =
      Number(auth.expiresIn) > 0
        ? Number(auth.expiresIn)
        : 3600;

    const expiresAt =
      Date.now() +
      expiresInSeconds * 1000;

    setAccessToken(auth.accessToken);
    setIsLocallyValid(true);

    await SecureStore.setItemAsync(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: auth.accessToken,
        expiresAt,
      })
    );
  }, []);

  // --------------------------------------------------
  // RESTORE STORED AUTH
  // --------------------------------------------------

  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        const authData =
          await SecureStore.getItemAsync(
            AUTH_STORAGE_KEY
          );

        if (!authData) {
          return;
        }

        const parsed =
          JSON.parse(authData);

        const token = parsed?.token;
        const expiresAt = parsed?.expiresAt;

        if (
          token &&
          expiresAt &&
          Date.now() < expiresAt
        ) {
          setAccessToken(token);
          setIsLocallyValid(true);
        } else {
          await clearAuth();
        }
      } catch (err) {
        console.warn(
          'Failed to restore Google Drive auth:',
          err
        );

        await clearAuth();
      }
    };

    hydrateAuth();
  }, [clearAuth]);

  // --------------------------------------------------
  // CONNECT GOOGLE DRIVE
  // --------------------------------------------------

  const connectDrive = async () => {
    if (isConnecting) {
      return null;
    }

    if (
      accessToken &&
      isLocallyValid
    ) {
      return accessToken;
    }

    if (!request) {
      return null;
    }

    setIsConnecting(true);

    try {
      const result =
        await promptAsync();

      // User closed/cancelled Google login
      if (
        result?.type === 'cancel' ||
        result?.type === 'dismiss'
      ) {
        return null;
      }

      if (
        result?.type === 'success' &&
        result.authentication?.accessToken
      ) {
        await persistAuth(
          result.authentication
        );

        return result.authentication
          .accessToken;
      }

      return null;
    } catch (err) {
      console.error(
        'Google Drive connection error:',
        err
      );

      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  // --------------------------------------------------
  // RETURN STORE API
  // --------------------------------------------------

  return {
    isReady: !!request,

    hasActiveSession:
      isLocallyValid,

    isConnecting,

    connectDrive,

    clearAuth,
  };
};