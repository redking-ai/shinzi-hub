import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const AUTH_STORAGE_KEY = 'drive_auth';

const DRIVE_API =
  'https://www.googleapis.com/drive/v3';

const DRIVE_UPLOAD_API =
  'https://www.googleapis.com/upload/drive/v3';

const SHINZI_FOLDER_NAME = 'Shinzi';

const SHINZI_SUBFOLDERS = {
  profiles: 'Profiles',
  banners: 'Banners',
  photos: 'Photos',
  videos: 'Videos',
  files: 'Files',
  others: 'Others',
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

const throwDriveError = async (
  response,
  fallbackMessage
) => {
  if (response.ok) {
    return;
  }

  let message = fallbackMessage;

  try {
    const data = await response.json();

    if (data?.error?.message) {
      message = data.error.message;
    }
  } catch {
    // Ignore JSON parsing failure.
  }

  throw new Error(
    `Google Drive error (${response.status}): ${message}`
  );
};

// --------------------------------------------------
// GOOGLE DRIVE STORE
// --------------------------------------------------

export const useDriveStore = () => {
  const [accessToken, setAccessToken] =
    useState(null);

  const [isLocallyValid, setIsLocallyValid] =
    useState(false);

  const [isConnecting, setIsConnecting] =
    useState(false);

  const [request, , promptAsync] =
    Google.useAuthRequest({
      androidClientId:
        '1063333455169-9vms8ijn450afpf27ma36ed3cu08h7je.apps.googleusercontent.com',

      scopes: [
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

  // --------------------------------------------------
  // CLEAR AUTH
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
  // SAVE AUTH
  // --------------------------------------------------

  const persistAuth = useCallback(
    async (auth) => {
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

      setAccessToken(
        auth.accessToken
      );

      setIsLocallyValid(true);

      await SecureStore.setItemAsync(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          token: auth.accessToken,
          expiresAt,
        })
      );
    },
    []
  );

  // --------------------------------------------------
  // RESTORE AUTH
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
        const expiresAt =
          parsed?.expiresAt;

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
  // CONNECT DRIVE
  // --------------------------------------------------

  const connectDrive = useCallback(
    async () => {
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
    },
    [
      accessToken,
      isLocallyValid,
      isConnecting,
      request,
      promptAsync,
      persistAuth,
    ]
  );

  // --------------------------------------------------
  // GET VALID TOKEN
  // --------------------------------------------------

  const getValidAccessToken =
    useCallback(async () => {
      if (
        accessToken &&
        isLocallyValid
      ) {
        return accessToken;
      }

      return connectDrive();
    }, [
      accessToken,
      isLocallyValid,
      connectDrive,
    ]);

  // --------------------------------------------------
  // FIND FOLDER
  // --------------------------------------------------

  const findFolder = useCallback(
    async (
      token,
      name,
      parentId = null
    ) => {
      let query =
        `name = '${name.replace(/'/g, "\\'")}'` +
        ` and mimeType = 'application/vnd.google-apps.folder'` +
        ` and trashed = false`;

      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      const url =
        `${DRIVE_API}/files` +
        `?q=${encodeURIComponent(query)}` +
        `&spaces=drive` +
        `&pageSize=1` +
        `&fields=files(id,name,mimeType,parents)`;

      const response =
        await fetch(url, {
          headers:
            getAuthHeader(token),
        });

      await throwDriveError(
        response,
        'Unable to search Google Drive folders.'
      );

      const data =
        await response.json();

      return data?.files?.[0] || null;
    },
    []
  );

  // --------------------------------------------------
  // CREATE FOLDER
  // --------------------------------------------------

  const createFolder = useCallback(
    async (
      token,
      name,
      parentId = null
    ) => {
      const body = {
        name,
        mimeType:
          'application/vnd.google-apps.folder',
      };

      if (parentId) {
        body.parents = [parentId];
      }

      const response =
        await fetch(
          `${DRIVE_API}/files?fields=id,name,mimeType,parents`,
          {
            method: 'POST',

            headers: {
              ...getAuthHeader(token),
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify(body),
          }
        );

      await throwDriveError(
        response,
        `Unable to create Drive folder "${name}".`
      );

      return response.json();
    },
    []
  );

  // --------------------------------------------------
  // GET OR CREATE FOLDER
  // --------------------------------------------------

  const getOrCreateFolder =
    useCallback(
      async (
        token,
        name,
        parentId = null
      ) => {
        const existing =
          await findFolder(
            token,
            name,
            parentId
          );

        if (existing) {
          return existing;
        }

        return createFolder(
          token,
          name,
          parentId
        );
      },
      [
        findFolder,
        createFolder,
      ]
    );

  // --------------------------------------------------
  // GET SHINZI ROOT FOLDER
  // --------------------------------------------------

  const getShinziFolder =
    useCallback(
      async (token) => {
        return getOrCreateFolder(
          token,
          SHINZI_FOLDER_NAME
        );
      },
      [getOrCreateFolder]
    );

  // --------------------------------------------------
  // GET SHINZI SUBFOLDER
  // --------------------------------------------------

  const getShinziSubfolder =
    useCallback(
      async (
        token,
        folderType
      ) => {
        const folderName =
          SHINZI_SUBFOLDERS[
            folderType
          ];

        if (!folderName) {
          throw new Error(
            `Unknown Shinzi folder type: ${folderType}`
          );
        }

        const root =
          await getShinziFolder(
            token
          );

        return getOrCreateFolder(
          token,
          folderName,
          root.id
        );
      },
      [
        getShinziFolder,
        getOrCreateFolder,
      ]
    );

  // --------------------------------------------------
  // UPLOAD FILE
  // --------------------------------------------------
  //
  // Uploads a real local file to Google Drive.
  //
  // local URI
  //    ↓
  // binary upload
  //    ↓
  // real Drive file ID
  //    ↓
  // rename + organize
  //
  // No fake IDs are generated.
  // --------------------------------------------------

  const uploadFile = useCallback(
    async ({
      localUri,
      fileName,
      mimeType,
      folderType = 'others',
    }) => {
      if (!localUri) {
        throw new Error(
          'A local file URI is required.'
        );
      }

      if (!fileName) {
        throw new Error(
          'A file name is required.'
        );
      }

      if (!mimeType) {
        throw new Error(
          'A MIME type is required.'
        );
      }

      const token =
        await getValidAccessToken();

      if (!token) {
        throw new Error(
          'Google Drive is not connected.'
        );
      }

      const folder =
        await getShinziSubfolder(
          token,
          folderType
        );

      // Read local file.
      const localResponse =
        await fetch(localUri);

      if (!localResponse.ok) {
        throw new Error(
          'Unable to read the selected local file.'
        );
      }

      const fileBlob =
        await localResponse.blob();

      if (!fileBlob) {
        throw new Error(
          'The selected file could not be converted into upload data.'
        );
      }

      // Upload actual binary content.
      const uploadResponse =
        await fetch(
          `${DRIVE_UPLOAD_API}/files?uploadType=media&fields=id,name,mimeType,size,parents`,
          {
            method: 'POST',

            headers: {
              ...getAuthHeader(token),
              'Content-Type': mimeType,
            },

            body: fileBlob,
          }
        );

      await throwDriveError(
        uploadResponse,
        'Unable to upload file to Google Drive.'
      );

      const uploaded =
        await uploadResponse.json();

      if (!uploaded?.id) {
        throw new Error(
          'Google Drive upload completed without returning a file ID.'
        );
      }

      // Organize and rename the real Drive file.
      const updateResponse =
        await fetch(
          `${DRIVE_API}/files/${encodeURIComponent(
            uploaded.id
          )}` +
          `?addParents=${encodeURIComponent(
            folder.id
          )}` +
          `&fields=id,name,mimeType,size,parents`,
          {
            method: 'PATCH',

            headers: {
              ...getAuthHeader(token),
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              name: fileName,
            }),
          }
        );

      await throwDriveError(
        updateResponse,
        'File uploaded but could not be organized inside the Shinzi folder.'
      );

      const finalFile =
        await updateResponse.json();

      return {
        fileId: finalFile.id,
        folderId: folder.id,
        fileName:
          finalFile.name ||
          fileName,
        mimeType:
          finalFile.mimeType ||
          mimeType,
        sizeBytes:
          finalFile.size
            ? Number(finalFile.size)
            : fileBlob.size,
      };
    },
    [
      getValidAccessToken,
      getShinziSubfolder,
    ]
  );

  // --------------------------------------------------
  // CREATE TEXT FILE
  // --------------------------------------------------
  //
  // Used by Shinzi Text Holder.
  //
  // Example:
  //
  // assetId:
  // shz-th60907
  //
  // Drive filename:
  // shz-th60907.txt
  //
  // The actual text content is stored inside
  // the user's Google Drive file.
  //
  // Default folder:
  // /Shinzi/Others
  // --------------------------------------------------

  const createTextFile = useCallback(
    async ({
      text,
      fileName,
      folderType = 'others',
    }) => {
      if (
        typeof text !== 'string'
      ) {
        throw new Error(
          'Text content must be a string.'
        );
      }

      if (!fileName) {
        throw new Error(
          'A file name is required.'
        );
      }

      const token =
        await getValidAccessToken();

      if (!token) {
        throw new Error(
          'Google Drive is not connected.'
        );
      }

      const folder =
        await getShinziSubfolder(
          token,
          folderType
        );

      // Create a UTF-8 text Blob.
      const textBlob =
        new Blob(
          [text],
          {
            type: 'text/plain; charset=utf-8',
          }
        );

      // Upload actual text content.
      const uploadResponse =
        await fetch(
          `${DRIVE_UPLOAD_API}/files?uploadType=media&fields=id,name,mimeType,size,parents`,
          {
            method: 'POST',

            headers: {
              ...getAuthHeader(token),
              'Content-Type':
                'text/plain; charset=utf-8',
            },

            body: textBlob,
          }
        );

      await throwDriveError(
        uploadResponse,
        'Unable to create text file in Google Drive.'
      );

      const uploaded =
        await uploadResponse.json();

      if (!uploaded?.id) {
        throw new Error(
          'Google Drive text upload completed without returning a file ID.'
        );
      }

      // Rename and organize the text file.
      const updateResponse =
        await fetch(
          `${DRIVE_API}/files/${encodeURIComponent(
            uploaded.id
          )}` +
          `?addParents=${encodeURIComponent(
            folder.id
          )}` +
          `&fields=id,name,mimeType,size,parents`,
          {
            method: 'PATCH',

            headers: {
              ...getAuthHeader(token),
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              name: fileName,
            }),
          }
        );

      await throwDriveError(
        updateResponse,
        'Text file was created but could not be organized inside the Shinzi folder.'
      );

      const finalFile =
        await updateResponse.json();

      return {
        fileId: finalFile.id,
        folderId: folder.id,
        fileName:
          finalFile.name ||
          fileName,
        mimeType:
          finalFile.mimeType ||
          'text/plain',
        sizeBytes:
          finalFile.size
            ? Number(finalFile.size)
            : new Blob([text]).size,
      };
    },
    [
      getValidAccessToken,
      getShinziSubfolder,
    ]
  );

  // --------------------------------------------------
  // GET FILE METADATA
  // --------------------------------------------------

  const getFileMetadata =
    useCallback(
      async (fileId) => {
        if (!fileId) {
          throw new Error(
            'A Google Drive file ID is required.'
          );
        }

        const token =
          await getValidAccessToken();

        if (!token) {
          throw new Error(
            'Google Drive is not connected.'
          );
        }

        const response =
          await fetch(
            `${DRIVE_API}/files/${encodeURIComponent(
              fileId
            )}` +
            `?fields=id,name,mimeType,size,parents,trashed`,
            {
              headers:
                getAuthHeader(token),
            }
          );

        await throwDriveError(
          response,
          'Unable to retrieve Google Drive file metadata.'
        );

        return response.json();
      },
      [getValidAccessToken]
    );

  // --------------------------------------------------
  // DELETE FILE
  // --------------------------------------------------

  const deleteFile =
    useCallback(
      async (fileId) => {
        if (!fileId) {
          throw new Error(
            'A Google Drive file ID is required.'
          );
        }

        const token =
          await getValidAccessToken();

        if (!token) {
          throw new Error(
            'Google Drive is not connected.'
          );
        }

        const response =
          await fetch(
            `${DRIVE_API}/files/${encodeURIComponent(
              fileId
            )}`,
            {
              method: 'DELETE',

              headers:
                getAuthHeader(token),
            }
          );

        await throwDriveError(
          response,
          'Unable to delete Google Drive file.'
        );

        return true;
      },
      [getValidAccessToken]
    );

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

    getValidAccessToken,

    getOrCreateFolder,

    getShinziFolder,

    getShinziSubfolder,

    uploadFile,

    createTextFile,

    getFileMetadata,

    deleteFile,
  };
};