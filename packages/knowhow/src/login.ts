import axios from "axios";
import fs from "fs";
import path from "path";
import { ask } from "./utils";

const API_URL = process.env.KNOWHOW_API_URL;

export async function login(): Promise<void> {
  if (!API_URL) {
    throw new Error("Error: KNOWHOW_API_URL environment variable not set.");
  }

  const [flag] = process.argv.slice(3);

  if (flag === "--jwt") {
    const jwt = await ask("Enter your JWT: ");

    // Update the JWT file
    const configDir = path.join(process.cwd(), ".knowhow");
    const jwtFile = path.join(configDir, ".jwt");

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(jwtFile, jwt);
    console.log("JWT updated successfully.");
  }

  // Get current user/org information
  try {
    const storedJwt = await loadJwt();
    const response = await axios.get(`${API_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${storedJwt}`,
      },
    });
    const user = response.data.user;
    const orgs = user.orgs;
    const orgId = response.data.orgId;

    const currentOrg = orgs.find((org) => {
      return org.organizationId === orgId;
    });

    console.log(
      `Current user: ${user.email}, \nOrganization: ${currentOrg?.organization?.name} - ${orgId}`
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Error: ${error.response.status} - ${
          error.response.data.message || "Unknown error"
        }`
      );
    }
    console.log(
      "Error: Unable to fetch user information. Please check your JWT and try again."
    );
  }
}

async function loadJwt(): Promise<string> {
  const jwtFile = path.join(process.cwd(), ".knowhow", ".jwt");
  if (!fs.existsSync(jwtFile)) {
    throw new Error("Error: JWT file not found.");
  }
  return fs.readFileSync(jwtFile, "utf-8").trim();
}
