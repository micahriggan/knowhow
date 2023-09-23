import * as fs from "fs";
import { promisify } from "util";
export const fileExists = promisify(fs.exists)
export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const mkdir = promisify(fs.mkdir);
