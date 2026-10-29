import { config } from '../config.js';

interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

interface S3Client {
  putObject(input: PutObjectInput): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): string;
}

function createS3Client(): S3Client {
  const endpoint = config.MINIO_ENDPOINT;
  const bucket = config.MINIO_BUCKET;
  const accessKey = config.MINIO_ACCESS_KEY;
  const secretKey = config.MINIO_SECRET_KEY;

  return {
    async putObject({ key, body, contentType }: PutObjectInput): Promise<void> {
      const url = `${endpoint}/${bucket}/${key}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Content-Length': body.length.toString(),
          'Authorization': `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString('base64')}`,
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
      }
    },
    getSignedUrl(key: string, _expiresIn = 3600): string {
      return `${endpoint}/${bucket}/${key}`;
    },
  };
}

export const s3 = createS3Client();
