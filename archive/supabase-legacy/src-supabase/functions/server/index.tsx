import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js';

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  '/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }),
);

// Initialize Supabase with service role (bypasses RLS)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Initialize storage buckets on startup
const BUCKET_NAME = 'make-9f6fb44c-character-portraits';

// Ensure bucket exists
(async () => {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log(`Creating storage bucket: ${BUCKET_NAME}`);
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
      } else {
        console.log('Bucket created successfully');
      }
    } else {
      console.log(`Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error('Error checking/creating bucket:', error);
  }
})();

// Health check endpoint
app.get('/make-server-9f6fb44c/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Upload character portrait
 */
app.post('/make-server-9f6fb44c/characters/upload-portrait', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (!user || authError) {
      console.error('Unauthorized upload attempt:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only images are allowed.' }, 400);
    }

    // Validate file size (5MB)
    if (file.size > 5242880) {
      return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

    console.log(`Uploading portrait: ${fileName}, size: ${file.size}, type: ${file.type}`);

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 31536000); // 1 year in seconds

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL:', urlError);
      return c.json({ error: 'Failed to create signed URL' }, 500);
    }

    console.log('Portrait uploaded successfully:', fileName);
    return c.json({ 
      url: signedUrlData.signedUrl,
      fileName: fileName
    });
  } catch (error) {
    console.error('Error in upload-portrait endpoint:', error);
    return c.json({ error: 'Internal server error during upload' }, 500);
  }
});

/**
 * Get signed URL for existing portrait
 */
app.post('/make-server-9f6fb44c/characters/get-portrait-url', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { fileName } = await c.req.json();
    
    if (!fileName) {
      return c.json({ error: 'fileName is required' }, 400);
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 31536000);

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL:', urlError);
      return c.json({ error: 'Failed to create signed URL' }, 500);
    }

    return c.json({ url: signedUrlData.signedUrl });
  } catch (error) {
    console.error('Error in get-portrait-url endpoint:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Find project by code (public endpoint for joining)
 * This bypasses RLS to allow users to find projects they want to join
 */
app.post('/make-server-9f6fb44c/projects/find-by-code', async (c) => {
  try {
    const { code } = await c.req.json();

    if (!code) {
      return c.json({ error: 'Code is required' }, 400);
    }

    console.log('Finding project by code:', code);

    // Use admin client to bypass RLS
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('id, code, name, description, status, gm_user_id, created_at')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !project) {
      console.error('Project not found:', error);
      return c.json({ error: 'Projekt nicht gefunden' }, 404);
    }

    // Only return projects that are active or paused (not completed)
    if (project.status === 'completed') {
      return c.json({ error: 'Dieses Projekt ist bereits abgeschlossen' }, 400);
    }

    console.log('Project found:', project.id);
    return c.json({ project });
  } catch (error) {
    console.error('Error finding project by code:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Find session by code (public endpoint for joining)
 * This bypasses RLS to allow users to find sessions they want to join
 */
app.post('/make-server-9f6fb44c/sessions/find-by-code', async (c) => {
  try {
    const { code } = await c.req.json();

    if (!code) {
      return c.json({ error: 'Code is required' }, 400);
    }

    console.log('Finding session by code:', code);

    // Use admin client to bypass RLS
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('id, code, name, adventure_id, gm_user_id, status, created_at, updated_at, started_at, ended_at')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !session) {
      console.error('Session not found:', error);
      return c.json({ error: 'Session nicht gefunden' }, 404);
    }

    // Only return sessions that are not completed
    if (session.status === 'completed') {
      return c.json({ error: 'Diese Session ist bereits abgeschlossen' }, 400);
    }

    console.log('Session found:', session.id);
    return c.json({ session });
  } catch (error) {
    console.error('Error finding session by code:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);
