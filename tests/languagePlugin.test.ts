import { LanguagePlugin } from "../src/plugins/language";
import { Config } from "../src/types";
import * as utils from "../src/utils";
import { getConfig, getLanguageConfig } from "../src/config";

jest.mock("../src/utils", () => ({
  readFile: jest.fn(),
  fileExists: jest.fn(),
  fileStat: jest.fn(),
}));

jest.mock("../src/config", () => ({
  getConfig: jest.fn(),
  getLanguageConfig: jest.fn(),
}));

const mockedConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockedLanguageConfig = getLanguageConfig as jest.MockedFunction<
  typeof getLanguageConfig
>;

describe("LanguagePlugin", () => {
  const userPrompt = "test prompt including terms";

  /*
   *  test("should call the correct plugins based on the user prompt", async () => {
   *    mockedConfig.mockResolvedValue({ plugins: ["github", "asana"] } as Config);
   *    mockedLanguageConfig.mockResolvedValue({
   *      test: {
   *        sources: [
   *          { kind: "github", data: ["http://github.com/test"] },
   *          { kind: "asana", data: ["http://asana.com/test"] },
   *        ],
   *      },
   *    });
   *
   *    const languagePlugin = new LanguagePlugin();
   *    const pluginResponse = await languagePlugin.call(userPrompt);
   *
   *    expect(utils.fileExists).toHaveBeenCalled();
   *    expect(utils.readFile).toHaveBeenCalled();
   *    expect(Plugins.listPlugins).toHaveBeenCalled();
   *    expect(Plugins.call).toHaveBeenCalledWith("github", expect.any(String));
   *    expect(Plugins.call).toHaveBeenCalledWith("asana", expect.any(String));
   *    expect(pluginResponse).toContain(
   *      "LANGUAGE PLUGIN: The following terms triggered expansions"
   *    );
   *  });
   */

  test("should return a message if no matching terms found", async () => {
    mockedConfig.mockResolvedValue({ plugins: ["github"] } as Config);
    mockedLanguageConfig.mockResolvedValue({});

    const languagePlugin = new LanguagePlugin();
    const pluginResponse = await languagePlugin.call(userPrompt);

    expect(pluginResponse).toEqual("LANGUAGE PLUGIN: No matching terms found");
  });
});
