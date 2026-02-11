import feathers from '@feathersjs/feathers';
import express from '@feathersjs/express';
import socketio from '@feathersjs/socketio';
import configuration from '@feathersjs/configuration';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import middleware from './middleware/index.js';
import services from './services/index.js';
import appHooks from './app.hooks.js';
import channels from './channels.js';
import authentication from './authentication.js';
import mongoose from './mongoose.js';
import redis from './redis.js';
import logger from './logger.js';
import configureScheduler from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create Express app
const app = express(feathers());

// Load app configuration
app.configure(configuration());

// Enable security, CORS, compression and body parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set up Plugins and providers
app.configure(express.rest());
app.configure(socketio());

// Configure database
app.configure(mongoose);
app.configure(redis);

// Configure authentication
app.configure(authentication);

// Add Express route for file upload (needed for multer compatibility)
// Must be added BEFORE services to ensure proper middleware order
import { upload, storageUtils } from './utils/storage.js';

// Handle preflight OPTIONS request for /upload
app.options('/upload', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.post('/upload',
  // Use multer middleware
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'portfolio', maxCount: 5 },
    { name: 'document', maxCount: 10 },
    { name: 'signedOfferLetter', maxCount: 1 }
  ]),
  async (req, res) => {
    // Ensure CORS headers are set
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Simple JWT authentication check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const files = req.files;
      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const uploadedFiles = {};

      // Process uploaded files
      for (const [fieldName, fileArray] of Object.entries(files)) {
        const processedFiles = [];
        for (const file of fileArray) {
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

      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET endpoint to retrieve signed URL for a file key
app.get('/upload/:key(*)', async (req, res) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    // Generate signed URL for the file
    const signedUrl = await storageUtils.getSignedUrl(key, 3600); // 1 hour expiry
    const publicUrl = storageUtils.getFileUrl(key);

    res.json({
      signedUrl,
      publicUrl,
      key
    });
  } catch (error) {
    console.error('Get signed URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configure middleware
app.configure(middleware);

// Configure services
app.configure(services);

// Add endpoint to generate signed URL from public URL
app.get('/signed-url', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    let key;
    
    // Check if it's already just a key (doesn't start with http)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      key = url;
    } else {
      // Extract the key from the full URL
      // URL format: https://endpoint/bucket/key
      const urlParts = url.split(`${process.env.S3_BUCKET}/`);
      if (urlParts.length < 2) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      key = urlParts[1].split('?')[0]; // Remove query params if any
    }

    // Generate signed URL
    const signedUrl = await storageUtils.getSignedUrl(key, 3600); // 1 hour expiry

    res.json({ signedUrl, key });
  } catch (error) {
    console.error('Signed URL generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configure channels
app.configure(channels);

// Configure hooks
app.hooks(appHooks);

// Configure lightweight scheduler (skips in test env)
configureScheduler(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve OpenAPI spec and simple docs
app.get('/openapi.yaml', (req, res) => {
  const openApiPath = path.join(__dirname, '..', 'openapi.yaml');
  console.log('Serving OpenAPI from:', openApiPath);

  // Check if file exists
  if (!fs.existsSync(openApiPath)) {
    console.error('OpenAPI file not found at:', openApiPath);
    return res.status(404).json({ error: 'OpenAPI specification not found' });
  }

  res.sendFile(openApiPath);
});

app.get('/docs', (req, res) => {
  const openApiPath = path.join(__dirname, '..', 'openapi.yaml');

  if (!fs.existsSync(openApiPath)) {
    return res.type('html').send(`<!doctype html>
<html>
<head><meta charset="utf-8"/><title>Job Finder API Docs</title></head>
<body>
  <h1>API Documentation</h1>
  <p>OpenAPI specification file not found. Please check the server configuration.</p>
  <p>Expected location: ${openApiPath}</p>
</body>
</html>`);
  }

  res.type('html').send(`<!doctype html>
<html>
<head><meta charset="utf-8"/><title>Job Finder API Docs</title></head>
<body>
  <redoc spec-url="/api/openapi.yaml"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`);
});

// Configure error handling
app.use(express.notFound());
app.use(express.errorHandler({ logger }));

export default app;
