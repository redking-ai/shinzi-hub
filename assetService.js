import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

import { db } from '../firebaseConfig';

// ============================================================
// SHINZI ASSET SERVICE
// ============================================================
//
// Responsibilities:
// - Generate Shinzi asset IDs.
// - Generate random 5-digit identifiers.
// - Prevent asset-ID collisions.
// - Validate asset types and visibility.
// - Create/read/update/delete Firebase asset metadata.
//
// Google Drive operations are handled by store.js.
//
// Flow:
//
// UI
//   ↓
// assetService.js
//   ↓
// store.js
//   ↓
// Google Drive
//   ↓
// real Drive file ID
//   ↓
// assetService.js
//   ↓
// Firebase /assets/{assetId}
//
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const ASSET_COLLECTION = 'assets';

const RANDOM_CODE_MIN = 0;
const RANDOM_CODE_MAX = 99999;

const MAX_ID_GENERATION_ATTEMPTS = 20;


// ============================================================
// ASSET TYPES
// ============================================================

export const ASSET_TYPES = Object.freeze({
  PROFILE_PHOTO: 'profile_photo',
  BANNER: 'banner',

  // Text Holder
  TEXT_HOLDER: 'text_holder',

  SENT_PHOTO: 'sent_photo',
  SENT_VIDEO: 'sent_video',
  SENT_FILE: 'sent_file'
});


// ============================================================
// ASSET PREFIXES
// ============================================================

const ASSET_PREFIXES = Object.freeze({
  [ASSET_TYPES.PROFILE_PHOTO]: 'Ph',
  [ASSET_TYPES.BANNER]: 'Bh',

  // Text Holder
  [ASSET_TYPES.TEXT_HOLDER]: 'th',

  [ASSET_TYPES.SENT_PHOTO]: 'SPh',
  [ASSET_TYPES.SENT_VIDEO]: 'SVh',
  [ASSET_TYPES.SENT_FILE]: 'SFh'
});


// ============================================================
// VISIBILITY
// ============================================================

export const ASSET_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private'
});


// ============================================================
// STATUS
// ============================================================

export const ASSET_STATUS = Object.freeze({
  UPLOADING: 'uploading',
  ACTIVE: 'active',
  DELETED: 'deleted',
  FAILED: 'failed'
});


// ============================================================
// VALIDATION HELPERS
// ============================================================

const isValidAssetType = (type) => {
  return Object.values(ASSET_TYPES).includes(type);
};


const isValidVisibility = (visibility) => {
  return Object.values(ASSET_VISIBILITY).includes(visibility);
};


const isValidStatus = (status) => {
  return Object.values(ASSET_STATUS).includes(status);
};


const isValidNonEmptyString = (value) => {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
};


// ============================================================
// ASSET ID FORMAT
// ============================================================

const getAssetPrefix = (type) => {
  if (!isValidAssetType(type)) {
    throw new Error(
      `Invalid Shinzi asset type: ${type}`
    );
  }

  return ASSET_PREFIXES[type];
};


const isValidAssetIdForType = (
  assetId,
  type
) => {
  if (
    !isValidNonEmptyString(assetId) ||
    !isValidAssetType(type)
  ) {
    return false;
  }

  const prefix =
    getAssetPrefix(type);

  /*
   * Exact format:
   *
   * shz-Ph12345
   * shz-Bh12345
   * shz-th12345
   * shz-SPh12345
   * shz-SVh12345
   * shz-SFh12345
   *
   * Exactly 5 digits after the type prefix.
   */

  const pattern =
    new RegExp(
      `^shz-${prefix}\\d{5}$`
    );

  return pattern.test(
    assetId.trim()
  );
};


// ============================================================
// RANDOM 5-DIGIT CODE
// ============================================================

const generateRandomFiveDigits = () => {
  const number =
    Math.floor(
      Math.random() *
      (
        RANDOM_CODE_MAX -
        RANDOM_CODE_MIN +
        1
      )
    ) + RANDOM_CODE_MIN;

  return String(number).padStart(
    5,
    '0'
  );
};


// ============================================================
// ASSET ID GENERATOR
// ============================================================

/**
 * Generates a unique Shinzi asset ID.
 *
 * Examples:
 *
 * shz-Ph09109
 * shz-Bh14589
 * shz-th60907
 * shz-SPh91068
 * shz-SVh90018
 * shz-SFh98993
 */
export const generateAssetId = async (
  type
) => {
  if (!isValidAssetType(type)) {
    throw new Error(
      `Invalid Shinzi asset type: ${type}`
    );
  }

  const prefix =
    getAssetPrefix(type);

  for (
    let attempt = 0;
    attempt < MAX_ID_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const randomDigits =
      generateRandomFiveDigits();

    const assetId =
      `shz-${prefix}${randomDigits}`;

    const assetRef =
      doc(
        db,
        ASSET_COLLECTION,
        assetId
      );

    const assetSnapshot =
      await getDoc(assetRef);

    if (!assetSnapshot.exists()) {
      return assetId;
    }
  }

  throw new Error(
    'Unable to generate a unique Shinzi asset ID. Please try again.'
  );
};


// ============================================================
// GET ASSET
// ============================================================

/**
 * Retrieves an asset document by Shinzi asset ID.
 *
 * Example:
 *
 * getAsset('shz-th60907')
 */
export const getAsset = async (
  assetId
) => {
  if (
    !isValidNonEmptyString(
      assetId
    )
  ) {
    throw new Error(
      'A valid asset ID is required.'
    );
  }

  const assetRef =
    doc(
      db,
      ASSET_COLLECTION,
      assetId.trim()
    );

  const snapshot =
    await getDoc(assetRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    assetId: snapshot.id,
    ...snapshot.data()
  };
};


// ============================================================
// CREATE ASSET RECORD
// ============================================================

/**
 * Creates a Firebase asset record.
 *
 * `assetId` can be supplied when the caller needs
 * to use the same Shinzi ID for the Google Drive
 * filename BEFORE the Drive upload.
 *
 * Example:
 *
 * assetId:
 *   shz-Ph12345
 *
 * Drive filename:
 *   shz-Ph12345.jpg
 *
 * Firebase document:
 *   /assets/shz-Ph12345
 *
 * If assetId is omitted, this function generates
 * one automatically.
 *
 * IMPORTANT:
 * This function requires a REAL Google Drive
 * providerFileId.
 *
 * It does NOT create fake Drive IDs.
 */
export const createAssetRecord = async ({
  assetId: providedAssetId = null,
  ownerUid,
  type,
  visibility,
  providerFileId,
  driveFolderId,
  fileName,
  mimeType,
  sizeBytes,
  version = 1,
  status = ASSET_STATUS.ACTIVE
}) => {

  // ------------------------------
  // Basic validation
  // ------------------------------

  if (
    !isValidNonEmptyString(
      ownerUid
    )
  ) {
    throw new Error(
      'ownerUid is required.'
    );
  }

  if (!isValidAssetType(type)) {
    throw new Error(
      `Invalid Shinzi asset type: ${type}`
    );
  }

  if (
    !isValidVisibility(
      visibility
    )
  ) {
    throw new Error(
      `Invalid asset visibility: ${visibility}`
    );
  }

  if (
    !isValidNonEmptyString(
      providerFileId
    )
  ) {
    throw new Error(
      'A real Google Drive providerFileId is required.'
    );
  }

  if (
    !isValidNonEmptyString(
      driveFolderId
    )
  ) {
    throw new Error(
      'A real Google Drive driveFolderId is required.'
    );
  }

  if (
    !isValidNonEmptyString(
      fileName
    )
  ) {
    throw new Error(
      'fileName is required.'
    );
  }

  if (
    isValidNonEmptyString(
      mimeType
    ) === false
  ) {
    throw new Error(
      'mimeType is required.'
    );
  }

  if (
    typeof sizeBytes !== 'number' ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes < 0
  ) {
    throw new Error(
      'sizeBytes must be a valid non-negative number.'
    );
  }

  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new Error(
      'version must be a positive integer.'
    );
  }

  if (!isValidStatus(status)) {
    throw new Error(
      `Invalid asset status: ${status}`
    );
  }


  // ------------------------------
  // Determine asset ID
  // ------------------------------

  let assetId =
    providedAssetId;

  if (
    assetId !== null &&
    assetId !== undefined
  ) {
    if (
      !isValidAssetIdForType(
        assetId,
        type
      )
    ) {
      throw new Error(
        `Asset ID "${assetId}" does not match asset type "${type}".`
      );
    }

    assetId =
      assetId.trim();

  } else {
    assetId =
      await generateAssetId(
        type
      );
  }


  // ------------------------------
  // Firestore reference
  // ------------------------------

  const assetRef =
    doc(
      db,
      ASSET_COLLECTION,
      assetId
    );


  // ------------------------------
  // Final collision check
  // ------------------------------

  const existingAsset =
    await getDoc(assetRef);

  if (existingAsset.exists()) {
    throw new Error(
      `Shinzi asset ID "${assetId}" already exists.`
    );
  }


  // ------------------------------
  // Asset metadata
  // ------------------------------

  const assetData = {
    ownerUid:
      ownerUid.trim(),

    type,

    visibility,

    provider:
      'google_drive',

    providerFileId:
      providerFileId.trim(),

    driveFolderId:
      driveFolderId.trim(),

    fileName:
      fileName.trim(),

    mimeType:
      mimeType.trim(),

    sizeBytes,

    version,

    status,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp()
  };


  // ------------------------------
  // Create document
  // ------------------------------

  await setDoc(
    assetRef,
    assetData
  );


  return {
    assetId,
    ...assetData
  };
};


// ============================================================
// UPDATE ASSET
// ============================================================

/**
 * Updates allowed asset metadata.
 *
 * The owner UID cannot be changed here.
 */
export const updateAsset = async (
  assetId,
  updates
) => {

  if (
    !isValidNonEmptyString(
      assetId
    )
  ) {
    throw new Error(
      'A valid asset ID is required.'
    );
  }

  if (
    !updates ||
    typeof updates !== 'object'
  ) {
    throw new Error(
      'Asset updates must be an object.'
    );
  }


  // Prevent ownership/provider manipulation.

  const forbiddenFields = [
    'ownerUid',
    'createdAt',
    'provider',
    'providerFileId',
    'driveFolderId'
  ];

  for (
    const field of forbiddenFields
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        field
      )
    ) {
      throw new Error(
        `${field} cannot be modified through updateAsset().`
      );
    }
  }


  if (
    updates.visibility !== undefined &&
    !isValidVisibility(
      updates.visibility
    )
  ) {
    throw new Error(
      `Invalid asset visibility: ${updates.visibility}`
    );
  }


  if (
    updates.status !== undefined &&
    !isValidStatus(
      updates.status
    )
  ) {
    throw new Error(
      `Invalid asset status: ${updates.status}`
    );
  }


  if (
    updates.version !== undefined &&
    (
      typeof updates.version !== 'number' ||
      !Number.isInteger(
        updates.version
      ) ||
      updates.version < 1
    )
  ) {
    throw new Error(
      'version must be a positive integer.'
    );
  }


  if (
    updates.sizeBytes !== undefined &&
    (
      typeof updates.sizeBytes !== 'number' ||
      !Number.isFinite(
        updates.sizeBytes
      ) ||
      updates.sizeBytes < 0
    )
  ) {
    throw new Error(
      'sizeBytes must be a valid non-negative number.'
    );
  }


  if (
    updates.fileName !== undefined &&
    !isValidNonEmptyString(
      updates.fileName
    )
  ) {
    throw new Error(
      'fileName must be a non-empty string.'
    );
  }


  if (
    updates.mimeType !== undefined &&
    !isValidNonEmptyString(
      updates.mimeType
    )
  ) {
    throw new Error(
      'mimeType must be a non-empty string.'
    );
  }


  const assetRef =
    doc(
      db,
      ASSET_COLLECTION,
      assetId.trim()
    );


  const snapshot =
    await getDoc(assetRef);

  if (!snapshot.exists()) {
    throw new Error(
      `Asset ${assetId} does not exist.`
    );
  }


  await updateDoc(
    assetRef,
    {
      ...updates,
      updatedAt:
        serverTimestamp()
    }
  );


  return getAsset(
    assetId
  );
};


// ============================================================
// DELETE ASSET
// ============================================================

/**
 * Deletes an asset metadata document.
 *
 * IMPORTANT:
 * This does NOT delete the Google Drive file.
 *
 * Real Drive deletion is handled through store.js.
 */
export const deleteAsset = async (
  assetId
) => {

  if (
    !isValidNonEmptyString(
      assetId
    )
  ) {
    throw new Error(
      'A valid asset ID is required.'
    );
  }


  const assetRef =
    doc(
      db,
      ASSET_COLLECTION,
      assetId.trim()
    );


  const snapshot =
    await getDoc(assetRef);

  if (!snapshot.exists()) {
    return false;
  }


  await deleteDoc(
    assetRef
  );

  return true;
};


// ============================================================
// EXPORT HELPERS
// ============================================================

export const isAssetType =
  isValidAssetType;

export const isAssetVisibility =
  isValidVisibility;

export const isAssetStatus =
  isValidStatus;

export const isAssetIdForType =
  isValidAssetIdForType;