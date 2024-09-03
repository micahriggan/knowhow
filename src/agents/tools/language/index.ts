import { getLanguageConfig, updateLanguageConfig } from "../../../config";
import { IDatasource } from "../../../types";

export async function addLanguageTerm(term: string, sources: IDatasource[]) {
  const language = await getLanguageConfig();
  language[term] = { sources };
  await updateLanguageConfig(language);
}
