import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a Supabase client with persistent sessions 
// and auto-refreshing tokens to prevent auto-logout
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storageKey: 'grievance-app-auth',
      detectSessionInUrl: true,
    }
  }
);

/**
 * Uploads a file to Supabase Storage, creating the bucket if it doesn't exist
 * @param file The file to upload
 * @param bucketName The name of the storage bucket
 * @param path Optional path prefix for the file
 * @returns The URL of the uploaded file or null if upload failed
 */
export const uploadFileToSupabase = async (
  file: File,
  bucketName: string,
  path: string = ''
): Promise<string | null> => {
  try {
    console.log(`Uploading file ${file.name} to bucket ${bucketName}...`);
    
    // Bucket should already be created manually in Supabase dashboard
    // Skip bucket creation attempt which might trigger RLS issues
    
    // Create unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}${path ? '/' : ''}${Date.now()}.${fileExt}`;
    
    console.log(`Generated filename: ${fileName}`);
    
    // Upload file
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw new Error('File upload failed: ' + uploadError.message);
    }
    
    console.log('File uploaded successfully:', data?.path);
    
    // Get public URL
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
    return fileUrl;
  } catch (error) {
    console.error('Error in uploadFileToSupabase:', error);
    return null;
  }
};