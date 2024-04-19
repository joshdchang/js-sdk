import { LIT_ENDPOINT_VERSION } from '@lit-protocol/constants';
import { DevEnv, LIT_TESTNET } from 'local-tests/setup/tinny-setup';
import { getPkpSessionSigs } from 'local-tests/setup/session-sigs/get-pkp-session-sigs';

/**
 * Test Commands:
 * ✅ NETWORK=cayenne yarn test:local --filter=testUsePkpSessionSigsToExecuteJsJsonResponse
 * ✅ NETWORK=manzano yarn test:local --filter=testUsePkpSessionSigsToExecuteJsJsonResponse
 * ✅ NETWORK=localchain yarn test:local --filter=testUsePkpSessionSigsToExecuteJsJsonResponse
 */
export const testUsePkpSessionSigsToExecuteJsJsonResponse = async (
  devEnv: DevEnv
) => {
  devEnv.useNewPrivateKey();
  devEnv.setExecuteJsVersion(LIT_TESTNET.LOCALCHAIN, LIT_ENDPOINT_VERSION.V1);

  const pkpSessionSigs = await getPkpSessionSigs(devEnv);

  const res = await devEnv.litNodeClient.executeJs({
    sessionSigs: pkpSessionSigs,
    code: `(async () => {
      console.log('hello world')

      LitActions.setResponse({
        response: JSON.stringify({hello: 'world'})
      });

    })();`,
  });

  // Expected output:
  // {
  //   success: true,
  //   signedData: {},
  //   decryptedData: {},
  //   claimData: {},
  //   response: "{\"hello\":\"world\"}",
  //   logs: "hello world\n",
  // }

  // -- assertions
  if (!res.response) {
    throw new Error(`Expected "response" in res`);
  }

  if (!res.response.startsWith('{')) {
    throw new Error(`Expected "response" to start with {`);
  }

  if (!res.response.endsWith('}')) {
    throw new Error(`Expected "response" to end with }`);
  }

  if (!res.logs) {
    throw new Error(`Expected "logs" in res`);
  }

  if (!res.logs.includes('hello world')) {
    throw new Error(`Expected "logs" to include 'hello world'`);
  }

  if (!res.success) {
    throw new Error(`Expected "success" in res`);
  }

  if (res.success !== true) {
    throw new Error(`Expected "success" to be true`);
  }
};
