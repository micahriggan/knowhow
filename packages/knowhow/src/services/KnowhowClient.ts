import axios from "axios";
import fs from "fs";
import path from "path";
import { Config } from "../types";

function loadJwt(): string {
  const jwtFile = path.join(process.cwd(), ".knowhow", ".jwt");
  if (!fs.existsSync(jwtFile)) {
    return "";
  }
  return fs.readFileSync(jwtFile, "utf-8").trim();
}

export class KnowhowSimpleClient {
  jwt = loadJwt();
  headers = {};

  constructor(private baseUrl) {
    const storedJwt = loadJwt();

    this.headers = {
      Authorization: `Bearer ${storedJwt}`,
    };
  }

  checkJwt() {
    if (!this.jwt) {
      throw new Error("No JWT found. Please login first.");
    }
  }

  me() {
    this.checkJwt();
    return axios.get(`${this.baseUrl}/api/users/me`, {
      headers: this.headers,
    });
  }

  async getPresignedUploadUrl(source: Config["embedSources"][0]) {
    this.checkJwt();
    const id = source.remoteId;
    const presignedUrlResp = await axios.post(
      `${this.baseUrl}/api/org-embeddings/${id}/upload`,
      {},
      {
        headers: this.headers,
      }
    );

    console.log(presignedUrlResp.data);

    const presignedUrl = presignedUrlResp.data.uploadUrl;
    return presignedUrl;
  }

  async getPresignedDownloadUrl(source: Config["embedSources"][0]) {
    this.checkJwt();
    const id = source.remoteId;
    const presignedUrlResp = await axios.post(
      `${this.baseUrl}/api/org-embeddings/${id}/download`,
      {},
      {
        headers: this.headers,
      }
    );

    console.log(presignedUrlResp.data);

    const presignedUrl = presignedUrlResp.data.downloadUrl;
    return presignedUrl;
  }
}

export const knowhowApiClient = new KnowhowSimpleClient(
  process.env.KNOWHOW_API_URL
);
