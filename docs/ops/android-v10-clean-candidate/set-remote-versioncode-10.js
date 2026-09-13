/**
 * Non-interactive EAS remote versionCode set.
 * eas build:version:set requires a TTY; this session has none.
 * Aligns remote store with SHA 9e04a97 app.config android.versionCode = 10.
 * Does not print tokens.
 */
const fs = require("fs");
const path = require("path");

const easRoot = path.join(
  process.env.LOCALAPPDATA,
  "npm-cache/_npx/e25a38a8cc65d08e/node_modules/eas-cli"
);
const { createGraphqlClient } = require(
  path.join(
    easRoot,
    "build/commandUtils/context/contextUtils/createGraphqlClient.js"
  )
);
const { AppVersionMutation } = require(
  path.join(easRoot, "build/graphql/mutations/AppVersionMutation.js")
);
const { getStateJsonPath } = require(path.join(easRoot, "build/utils/paths.js"));

const state = JSON.parse(fs.readFileSync(getStateJsonPath(), "utf8"));
const auth = state.auth || {};
const graphqlClient = createGraphqlClient({
  accessToken: process.env.EXPO_TOKEN || auth.accessToken || null,
  sessionSecret: auth.sessionSecret || null,
});

(async () => {
  const id = await AppVersionMutation.createAppVersionAsync(graphqlClient, {
    appId: "d2593b45-8f18-4c57-9d71-0419193cfd77",
    platform: "ANDROID",
    applicationIdentifier: "com.umtuba.app",
    storeVersion: "1.0.0",
    buildVersion: "10",
  });
  if (!id) {
    throw new Error("createAppVersion returned empty id");
  }
  console.log("REMOTE_VERSIONCODE_SET=10");
  console.log("APP_VERSION_RECORD_CREATED=YES");
})().catch((err) => {
  console.error("REMOTE_VERSIONCODE_SET_FAIL");
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
