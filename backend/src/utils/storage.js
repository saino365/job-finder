import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import crypto from 'crypto';
import path from 'path';

// Debug environment variables
console.log('S3 Environment Variables:');
console.log('S3_ENDPOINT:', process.env.S3_ENDPOINT);
console.log('S3_BUCKET:', process.env.S3_BUCKET);
console.log('S3_ACCESS_KEY:', process.env.S3_ACCESS_KEY ? 'SET' : 'NOT SET');
console.log('S3_SECRET_KEY:', process.env.S3_SECRET_KEY ? 'SET' : 'NOT SET');

// Configure S3 client for IpOneServer
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'ap-southeast-1', // Default region for IpOneServer
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for some S3-compatible services
});

// File filter function with field-specific validation
const fileFilter = (req, file, cb) => {
  const fieldName = file.fieldname;
  const mimetype = file.mimetype;

  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/rtf'
  ];

  const imageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  const spreadsheetTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const textTypes = ['text/plain'];

  if (fieldName === 'resume') {
    if (documentTypes.includes(mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Resume must be a PDF, DOC, DOCX, or RTF file. Image files are not allowed.'), false);
    }
  } else if (fieldName === 'avatar' || fieldName === 'logo') {
    if (imageTypes.includes(mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Avatar and logo must be image files (JPEG, PNG, or GIF).'), false);
    }
  } else if (fieldName === 'portfolio' || fieldName === 'document') {
    const allAllowedTypes = [...documentTypes, ...imageTypes, ...spreadsheetTypes, ...textTypes];
    if (allAllowedTypes.includes(mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, Word documents, Excel files, and text files are allowed.'), false);
    }
  } else {
    const allAllowedTypes = [...documentTypes, ...imageTypes, ...spreadsheetTypes, ...textTypes];
    if (allAllowedTypes.includes(mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'), false);
    }
  }
};

// Configure multer for S3 upload
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.S3_BUCKET,
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        uploadedBy: req.user?.id || 'anonymous',
        uploadedAt: new Date().toISOString()
      });
    },
    key: function (req, file, cb) {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;

      // Organize files by type
      let folder = 'misc';
      if (file.fieldname === 'resume') folder = 'resumes';
      else if (file.fieldname === 'avatar') folder = 'avatars';
      else if (file.fieldname === 'logo') folder = 'logos';
      else if (file.fieldname === 'portfolio') folder = 'portfolios';

      const key = `${folder}/${fileName}`;
      cb(null, key);
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Utility functions
const storageUtils = {
  // Generate signed URL for file access
  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  },

  // Delete file from storage
  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    return await s3Client.send(command);
  },

  // Upload file directly (without multer)
  async uploadFile(fileBuffer, fileName, contentType, folder = 'misc') {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read', // Make uploaded files publicly readable
      Metadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString()
      }
    });

    await s3Client.send(command);
    return key;
  },

  // Get file URL (public or signed)
  getFileUrl(key, signed = false, expiresIn = 3600) {
    if (signed) {
      return this.getSignedUrl(key, expiresIn);
    }

    // For public files (if bucket allows public access)
    return `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;
  }
};

export {
  s3Client,
  upload,
  storageUtils
};
