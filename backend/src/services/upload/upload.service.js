import { upload, storageUtils } from '../../utils/storage.js';
import { BadRequest } from '@feathersjs/errors';
import { hooks as authHooks } from '@feathersjs/authentication';

const { authenticate } = authHooks;

class UploadService {
  constructor(options, app) {
    this.options = options || {};
    this.app = app;
  }

  async create(data, params) {
    return new Promise((resolve, reject) => {
      // Check if req and res are available
      if (!params.req || !params.res) {
        console.log('❌ Upload service: req/res not available in params');
        console.log('Available params keys:', Object.keys(params));
        return reject(new BadRequest('Upload service requires HTTP request context. Make sure to use multipart/form-data and proper HTTP request.'));
      }

      console.log('✅ Upload service: req/res available, processing upload...');

      // Use multer middleware
      const uploadMiddleware = upload.fields([
        { name: 'resume', maxCount: 1 },
        { name: 'avatar', maxCount: 1 },
        { name: 'logo', maxCount: 1 },
        { name: 'portfolio', maxCount: 5 },
        { name: 'document', maxCount: 10 },
        { name: 'signedOfferLetter', maxCount: 1 }
      ]);

      uploadMiddleware(params.req, params.res, async (err) => {
        if (err) {
          console.log('❌ Multer error:', err.message);
          return reject(new BadRequest(err.message));
        }

        const files = params.req.files;
        console.log('📁 Files received:', files ? Object.keys(files) : 'none');

        if (!files || Object.keys(files).length === 0) {
          return reject(new BadRequest('No files uploaded'));
        }

        const uploadedFiles = {};

        // Process uploaded files
        for (const [fieldName, fileArray] of Object.entries(files)) {
          const processedFiles = [];
          for (const file of fileArray) {
            console.log(`📄 Processing file: ${file.originalname} -> ${file.key}`);
            const signedUrl = await storageUtils.getSignedUrl(file.key);
            processedFiles.push({
              key: file.key,
              originalName: file.originalname,
              size: file.size,
              mimetype: file.mimetype,
              url: storageUtils.getFileUrl(file.key),
              signedUrl: signedUrl
            });
          }
          uploadedFiles[fieldName] = processedFiles;
        }

        console.log('✅ Upload successful:', Object.keys(uploadedFiles));
        resolve({
          message: 'Files uploaded successfully',
          files: uploadedFiles
        });
      });
    });
  }

  async remove(id, params) {
    try {
      // id should be the file key
      await storageUtils.deleteFile(id);
      return { message: 'File deleted successfully', key: id };
    } catch (error) {
      throw new BadRequest(`Failed to delete file: ${error.message}`);
    }
  }

  async get(id, params) {
    try {
      // Generate signed URL for file access
      const signedUrl = await storageUtils.getSignedUrl(id, 3600); // 1 hour expiry
      return {
        key: id,
        signedUrl,
        publicUrl: storageUtils.getFileUrl(id)
      };
    } catch (error) {
      throw new BadRequest(`Failed to get file URL: ${error.message}`);
    }
  }
}

export default function (app) {
  const options = {
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/upload', new UploadService(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('upload');

  service.hooks({
    before: {
      all: [],
      find: [],
      get: [],
      create: [
        // Authenticate user before upload
        authenticate('jwt')
      ],
      update: [],
      patch: [],
      remove: [
        authenticate('jwt')
      ]
    },
    after: {
      all: [],
      find: [],
      get: [],
      create: [],
      update: [],
      patch: [],
      remove: []
    },
    error: {
      all: [],
      find: [],
      get: [],
      create: [],
      update: [],
      patch: [],
      remove: []
    }
  });
};
