import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

export class S3Service {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client();
  }

  async uploadFile(
    filePath: string,
    bucketName: string,
    key: string
  ): Promise<void> {
    const fileContent = await fs.promises.readFile(filePath);

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
    };

    // create bucket if it doesn't exist
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error) {
      if (error.statusCode === 404) {
        await this.s3.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket ${bucketName} created successfully`);
      } else {
        throw error;
      }
    }

    await this.s3.send(new PutObjectCommand(params));
    console.log(`File uploaded successfully to ${bucketName}/${key}`);
  }
}

export const AwsS3 = new S3Service();
