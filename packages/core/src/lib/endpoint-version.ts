import { isNode, log } from '@lit-protocol/misc';
import {
  LIT_ENDPOINT_VERSION,
  LIT_PROCESS_ENV,
  LIT_PROCESS_FLAG,
} from '@lit-protocol/constants';
import { LitEndpoint } from '@lit-protocol/types';

/**
 * Get the Lit endpoint path base on:
 * 1. The --version flag in the command line
 * 2. The LIT_ENDPOINT_VERSION environment variable
 * 3. Default to 'v1'
 *
 * @returns the Lit endpoint path. eg '/', '/v1', etc.
 */
export const getLitEndpointPath = () => {
  // default to 'v1'
  let endpointPath = LIT_ENDPOINT_VERSION.V1;

  if (isNode()) {
    const versionArg = process.argv.find((arg) =>
      arg.startsWith(LIT_PROCESS_FLAG.VERSION)
    );
    const version = versionArg ? versionArg.split('=')[1] : null;

    // Use environment variable if set; default to 'v1' otherwise
    let detectedVersion =
      version || // check for --version flag
      process.env[LIT_PROCESS_ENV.LIT_ENDPOINT_VERSION] || // check for environment variable
      LIT_ENDPOINT_VERSION.V1; // default to 'v1'

    // to lower case and prefix with '/' if not already
    detectedVersion = detectedVersion.toLowerCase();
    detectedVersion = detectedVersion.startsWith('/')
      ? detectedVersion
      : `/${detectedVersion}`;

    // get keys from LitEndPointPath enum
    const keys = Object.values(LIT_ENDPOINT_VERSION);

    if (!keys.includes(detectedVersion as LIT_ENDPOINT_VERSION)) {
      log(
        `[getLitEndpointPath] Invalid Lit endpoint version: "${detectedVersion}" - must be one of: "${keys.join(
          '", "'
        )}. Defaulting to "${LIT_ENDPOINT_VERSION.V1}".`
      );
    }

    endpointPath =
      detectedVersion === LIT_ENDPOINT_VERSION.V1
        ? LIT_ENDPOINT_VERSION.V1
        : LIT_ENDPOINT_VERSION.LEGACY;
  }

  log(`🔥 [getLitEndpointPath] Using Lit endpoint version: "${endpointPath}"`);

  return endpointPath;
};

/**
 * Compose the Lit URL
 * @param params
 * @returns the composed URL
 */
export const composeLitUrl = (params: {
  url: string;
  endpoint: LitEndpoint;
}) => {
  // check if params.url is a valid URL
  try {
    new URL(params.url);
  } catch (error) {
    throw new Error(`[composeLitUrl] Invalid URL: "${params.url}"`);
  }

  let versionOverride: string | null = null;

  // Get the version override for a particular endpoint
  if (isNode()) {
    versionOverride = process.env[`${params.endpoint.envName}`] || null;
  }

  // Use the overridden version if it exists, otherwise use the default
  const version = versionOverride || params.endpoint.version;

  return `${params.url}${params.endpoint.path}${version}`;
};
