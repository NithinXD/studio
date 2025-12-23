import { uploadImageToSupabase } from './supabaseUpload';

export type UploadedImage = {
  name: string;
  size: number;
  url: string;
  uploadedAt: string;
};

export async function handleImageUpload(params: {
  inspectionId: string;
  files: FileList | File[];
  section?: string;
  field?: string;
}): Promise<UploadedImage[]> {
  const fileArray = Array.from(params.files);
  const prefix = [params.section, params.field].filter(Boolean).join('/');
  const basePath = prefix ? `${params.inspectionId}/${prefix}` : params.inspectionId;

  const processedImages = await Promise.all(
    fileArray.map(async (file) => {
      const path = `${basePath}/${Date.now()}-${file.name}`;
      const url = await uploadImageToSupabase(file, path);
      return {
        name: file.name,
        size: file.size,
        url,
        uploadedAt: new Date().toISOString(),
      };
    })
  );

  return processedImages;
}