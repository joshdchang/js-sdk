import { LitNodeClientConfig } from '@lit-protocol/types';
import {
  OTPConfig,
  OrNull,
  OrUndefined,
  PersistentStorageConfig,
  StytchOTPProviderOptionsBrowser,
  StytchOTPProviderOptionsNodeJS,
  Types,
  infuraConfig,
  pinataConfig,
} from './types';
import {
  LitMessages,
  clearAuthMethodSessions,
  clearLitSessionItems,
  getProviderMap,
  getStoredAuthMethods,
  getStoredAuthMethodsWithKeys,
  getStoredEncryptedData,
  isBrowser,
  isNode,
  log,
} from './utils';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { Lit } from './lit';
import { ILitStorage, LitStorage } from '@lit-protocol/lit-storage';

import {
  AppleProvider,
  DiscordProvider,
  EthWalletProvider,
  GoogleProvider,
  StytchOtpProvider,
  WebAuthnProvider,
} from '@lit-protocol/lit-auth-client';
import { ProviderType } from '@lit-protocol/constants';
import { LitAuthClient } from '@lit-protocol/lit-auth-client';
import { LitEmitter } from './events/lit-emitter';
import { BrowserHelper } from './browser-helper';
import { BaseIPFSProvider } from './ipfs-provider/providers/base-ipfs-provider';
import { HeliaProvider } from './ipfs-provider/providers/helia-provider';
import { PinataProvider } from './ipfs-provider/providers/pinata-provider';
import { infuraProvider } from './ipfs-provider/providers/infura-provider';
import { handleAutoAuth } from './auth/handle-auto-auth';
import { getEnv, is } from '@lit-protocol/misc';
import { StytchOTPProviderBrowser } from './stych-otp-provider/providers/stytch-otp-provider-browser';
import { StytchOTPProviderNodeJS } from './stych-otp-provider/providers/stytch-otp-provider-nodejs';

const DEFAULT_NETWORK = 'cayenne'; // changing to "cayenne" soon

export class LitOptionsBuilder {
  private _contractOptions: OrUndefined<Types.ContractOptions> = undefined;
  private _authOptions: OrUndefined<Types.AuthOptions> = undefined;
  private _nodeClientOptions: OrUndefined<LitNodeClientConfig> = undefined;
  private _nodeClient: OrUndefined<Types.NodeClient> = undefined;

  private _persistentStorage: OrNull<BaseIPFSProvider> = null;
  private _otpProvider: OrNull<StytchOTPProviderBrowser | StytchOTPProviderNodeJS> = null;
  private _emitter: OrUndefined<LitEmitter> = undefined;
  private _storage: OrUndefined<LitStorage> = undefined;

  custom: {
    persistentStorage: boolean;
  } = {
      persistentStorage: false,
    };

  constructor() {
    this.initialiseEventEmitter();
    this.initialiseIPFSProvider({
      provider: 'helia',
    });
    this.initialiseOTPProvider({
      provider: 'stytch',
    })
    this.initialiseStorageProvider();
    this.createUtils();
    this.createBrowserUtils();
  }

  // ========== Default ==========ƒ
  // Converts the instance back to a function-like behavior.
  // When it is invoked directly, it should default to the normal execution behavior.
  async invoke({
    debug = true,
  }: {
    debug?: boolean;
  }): Promise<LitOptionsBuilder> {
    globalThis.Lit.debug = debug;

    return this;
  }

  // ========== With Methods ==========
  public withContractOptions(options: Types.ContractOptions) {
    log.info('------ withContractOptions ------');
    this._contractOptions = options;
    return this;
  }

  // -- if you want to customize the relay & OTP configurations
  public withAuthOptions(options: Types.AuthOptions) {
    log.info('------ withAuthOptions ------');
    this._authOptions = options;
    this.initialiseAuthClient();
    return this;
  }

  // -- if you want to customize the LitNodeClient configurations
  public async withNodeClient(client: Types.NodeClient) {
    log.info('------ withNodeClient ------');
    this._nodeClient = client;
    await this.build();
    return this;
  }

  // -- If you want to specify where to store your cache data, by default it will be stored in localStorage,
  // or memory if you are using NodeJS
  public withCacheProvider(provider: ILitStorage) {
    log.info('------ withCacheProvider ------');
    this._storage = new LitStorage({ storageProvider: provider });
    return this;
  }

  // -- If you want to specify which IPFS provider to use, by default it will be using Helia
  public withPersistentStorage({ provider, options }: PersistentStorageConfig) {
    log.info('------ withPersistentStorage ------');
    this.custom.persistentStorage = true;
    console.log(
      'this.custom.persistentStorage:',
      this.custom.persistentStorage
    );
    console.log(
      'globalThis.Lit.builder?.custom.persistentStorage:',
      globalThis.Lit.builder?.custom.persistentStorage
    );

    this.initialiseIPFSProvider({
      provider,
      options,
    });
    return this;
  }

  public withOTPProvider({ provider, options }: OTPConfig) {

    log.info('------ withOTPProvider ------');

    this.initialiseOTPProvider({
      provider,
      options,
    });

    return this;
  }

  // ========== Build ==========
  public async build(): Promise<void> {
    // await new Promise((resolve) => setTimeout(resolve, 10000));

    log.start('build', 'starting...');

    // -- start
    const nodeClientOpts = this._nodeClientOptions ?? {
      litNetwork: DEFAULT_NETWORK,
      debug: getEnv({
        nodeEnvVar: 'DEBUG',
        urlQueryValue: 'debug=true',
        defaultValue: false,
      }),
    };

    log('using class "LitNodeClient"');
    this._nodeClient = new LitNodeClient(nodeClientOpts);

    try {
      await this._nodeClient?.connect();
      log.success(
        '🎉 connected to LitNodeClient! ready:',
        this._nodeClient?.ready
      );
    } catch (e) {
      log.throw(`Error while attempting to connect to LitNodeClient ${e}`);
    }

    globalThis.Lit.nodeClient = this._nodeClient as Types.NodeClient;
    globalThis.Lit.instance = new Lit();
    log.info('"globalThis.Lit" has already been initialized!');

    if (!globalThis.Lit.instance) {
      return;
    }

    globalThis.Lit.instance.Configure = {
      ...this._authOptions,
      ...this._contractOptions,
      ...this._nodeClientOptions,
    };

    this.initialiseAuthClient();

    this._emitter?.emit('ready', true);
    globalThis.Lit.ready = true;
    log.end('build', 'done!');
  }

  // ========== Initialise ==========
  public initialiseAuthClient(): void {
    log.start('initialiseAuthClient', 'starting...');

    globalThis.Lit.authClient = new LitAuthClient({
      // redirectUri: window.location.href.replace(/\/+$/, ''),
      litRelayConfig: {
        relayApiKey: '67e55044-10b1-426f-9247-bb680e5fe0c8_relayer',
      },

      ...(this._authOptions && { ...this._authOptions }),
      litNodeClient: globalThis.Lit.nodeClient,
      storageProvider: globalThis.Lit.storage,
      version: 'V3',
    });

    if (!globalThis.Lit.authClient) {
      return log.throw('"globalThis.Lit.authClient" failed to initialize');
    }

    log.success('"globalThis.Lit.authClient" has been set!');

    log('setting "globalThis.Lit.auth"');

    if (isBrowser()) {
      globalThis.Lit.auth.google =
        globalThis.Lit.authClient.initProvider<GoogleProvider>(
          ProviderType.Google
        );
      globalThis.Lit.auth.discord =
        globalThis.Lit.authClient.initProvider<DiscordProvider>(
          ProviderType.Discord
        );
      globalThis.Lit.auth.webauthn =
        globalThis.Lit.authClient.initProvider<WebAuthnProvider>(
          ProviderType.WebAuthn
        );

      // globalThis.Lit.auth.apple =
      //   globalThis.Lit.authClient.initProvider<AppleProvider>(
      //     ProviderType.Apple
      //   );
      globalThis.Lit.auth.otp = new StytchOTPProviderBrowser({
        publicToken: '- not set -'
      });
    }

    // if (isNode()) {
    //   globalThis.Lit.auth.otp = new StytchOTPProviderBundled({
    //     projectId: process.env['STYTCH_PROJECT_ID'] || '',
    //     secret: process.env['STYTCH_SECRET'] || ''
    //   });
    // }

    globalThis.Lit.auth.ethwallet =
      globalThis.Lit.authClient.initProvider<EthWalletProvider>(
        ProviderType.EthWallet, {
        version: 'V3',
      }
      );

    // globalThis.Lit.auth.otp =
    //   globalThis.Lit.authClient.initProvider<StytchOtpProvider>(ProviderType.StytchOtp);

    let authStatus = Object.entries(globalThis.Lit.auth)
      .map(([key, value]) => {
        return `${value ? '✅' : '❌'} authMethodType: ${getProviderMap()[key.toLowerCase()]
          } |  ${key}`;
      })
      .join('\n');

    log.success('"globalThis.Lit.auth" has been set!');
    log.info('globalThis.Lit.auth', '\n' + authStatus);
    log.info(
      `(UPDATED AT: 14/07/2023) A list of available auth methods can be found in PKPPermissions.sol https://bit.ly/44HHa5n (private, to be public soon)`
    );

    log.end('initialiseAuthClient', 'done!');
  }

  public initialiseIPFSProvider({
    provider,
    options,
  }: PersistentStorageConfig): BaseIPFSProvider {
    log.start('initialiseIPFSProvider', 'starting...');
    try {
      // -- options for persistent storage
      const providerOptions = {
        helia: () => new HeliaProvider(),
        pinata: (options: pinataConfig) =>
          new PinataProvider({
            JWT: options.JWT ?? '',
          }),
        infura: (options: infuraConfig) =>
          new infuraProvider({
            API_KEY: options.API_KEY ?? '',
            API_KEY_SECRET: options.API_KEY_SECRET ?? '',
          }),
        // .. add more providers here
      };

      // -- select persistent storage provider
      if (providerOptions[provider]) {
        log.info('persistent storage provider selected: ', provider);
        const IPFSProvider = providerOptions[provider](options as any);

        // -- set globalThis.Lit.persistentStorage
        this._persistentStorage = IPFSProvider;
        globalThis.Lit.persistentStorage = IPFSProvider;
        if (globalThis.Lit.builder) {
          globalThis.Lit.builder._persistentStorage = IPFSProvider;
        }
        return IPFSProvider;
      } else {
        log.end('initialiseIPFSProvider', '1 ERROR!');
        log.throw(`Invalid persistentStorage option: ${options}`);
      }
    } catch (e) {
      log.end('initialiseIPFSProvider', '2 ERROR!');
      log.error(`
      Error while attempting to initialize IPFSProvider, please check your persistentStorage config\n
  
      ${LitMessages.persistentStorageExample}
      
      \n${e}`);
    }
    log.end('initialiseIPFSProvider', '3 ERROR!');
    log.throw(`Error while attempting to initialize IPFSProvider`);
  }

  public initialiseOTPProvider({
    provider,
    options,
  }: OTPConfig) {
    log.start("initialiseOTPProvider", "starting...");

    log.info("options:", options)

    try {
      const providerOptions = {
        stytch: () => {



          if (isNode()) {

            const _options = options as StytchOTPProviderOptionsNodeJS;

            return new StytchOTPProviderNodeJS({
              projectId: _options?.projectId ?? '',
              secret: _options?.secret ?? '',
            })
          }

          const _options = options as StytchOTPProviderOptionsBrowser;

          return new StytchOTPProviderBrowser({
            publicToken: _options?.publicToken ?? '',
          })

        },
      };

      if (providerOptions[provider]) {
        log.info('OTP Provider selected: ', provider);
        const StytchOTPProvider = providerOptions[provider]();

        // -- set globalThis.Lit.OTPProvider
        this._otpProvider = StytchOTPProvider;
        globalThis.Lit.auth.otp = StytchOTPProvider;

        if (globalThis.Lit.builder) {
          globalThis.Lit.builder._otpProvider = StytchOTPProvider;
        }

        log.end('initialiseOTPProvider', '0 ERROR!');
        return StytchOTPProvider;
      } else {
        log.end('initialiseOTPProvider', '1 ERROR!');
        log.throw(`Invalid OTPProvider option: ${options}`);
      }
    } catch (e) {
      log.end('initialiseOTPProvider', '2 ERROR!');
      log.error(`
      Error while attempting to initialize OTPProvider, please check your OTPProvider config\n
  
      ${LitMessages.OTPProviderExample}
      
      \n${e}`);
    }

    log.end("initialiseOTPProvider", "done!")

    return null;
  }

  public initialiseStorageProvider(): LitStorage {
    let storage;

    // -- initialize LitStorage
    try {
      storage = new LitStorage();
    } catch (e) {
      log.throw(`Error while attempting to initialize LitStorage\n${e}`);
    }

    if (!storage) {
      return log.throw(`Error while attempting to initialize LitStorage`);
    }

    // -- set globalThis.Lit.storage
    this._storage = storage;
    globalThis.Lit.storage = storage;

    return storage;
  }

  public initialiseEventEmitter() {
    let emitter;

    // -- initialize LitEmitter
    try {
      emitter = new LitEmitter();
    } catch (e) {
      log.throw(`Error while attempting to initialize LitEmitter\n${e}`);
    }

    if (!emitter) {
      return log.throw(`Error while attempting to initialize LitEmitter`);
    }

    // -- set globalThis.Lit.emitter
    this._emitter = emitter;
    globalThis.Lit.eventEmitter = emitter;

    return emitter;
  }

  // ========== Create Utils ==========
  public createUtils() {
    log.start('createUtils', 'starting...');

    globalThis.Lit.getStoredAuthMethods = getStoredAuthMethods;
    globalThis.Lit.getStoredAuthMethodsWithKeys = getStoredAuthMethodsWithKeys;
    globalThis.Lit.getStoredEncryptedData = getStoredEncryptedData;
    globalThis.Lit.clearAuthMethodSessions = clearAuthMethodSessions;
    globalThis.Lit.clearLitSessionItems = clearLitSessionItems;

    log.end('createUtils', 'done!');
  }

  public createBrowserUtils() {
    // -- validate
    if (isNode()) {
      log.info(
        'skipping "createBrowserUtils" as we are not in a browser environment'
      );
      return;
    }

    // -- create
    globalThis.Lit.browserHelper = new BrowserHelper();
  }
}

// ---------- (to be added/deleted) Enable auto auth for browser ----------
// if (isBrowser()) {
//   handleAutoAuth(async (authMethod: AuthMethod) => {
//     globalThis.Lit.eventEmitter?.createAccountStatus('in_progress');
//     log.info('Creating Lit account...');

//     try {
//       const PKPInfoArr = await globalThis.Lit.createAccount({
//         authMethods: [authMethod],
//       });
//       log.success('Lit account created!');
//       log.info(`PKPInfo: ${JSON.stringify(PKPInfoArr)}`);

//       if (Array.isArray(PKPInfoArr)) {
//         globalThis.Lit.eventEmitter?.createAccountStatus(
//           'completed',
//           PKPInfoArr
//         );
//       }
//     } catch (e) {
//       log.error(`Error while attempting to create Lit account ${e}`);
//       globalThis.Lit.eventEmitter?.createAccountStatus('failed');
//     }
//   });
// }
