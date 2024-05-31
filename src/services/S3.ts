import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream";
import * as util from "util";

const pipelineAsync = util.promisify(pipeline);

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

  async downloadFile(
    bucketName: string,
    key: string,
    destinationPath: string
  ): Promise<void> {
    const params = {
      Bucket: bucketName,
      Key: key,
    };
    const { Body } = await this.s3.send(new GetObjectCommand(params));
    const fileStream = fs.createWriteStream(destinationPath);

    await pipelineAsync(Body as NodeJS.ReadableStream, fileStream);

    console.log(
      `File downloaded successfully from ${bucketName}/${key} to ${destinationPath}`
    );
  }
}

export const AwsS3 = new S3Service();
