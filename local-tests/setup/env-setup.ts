// This file is a WIP test demo for auth unification. In this change, the only time we will create an authSig is to use it to generate session sigs
// client side. Anything server side, we will no longer accpet authSig.

import {
  AuthMethod,
  BaseSiweMessage,
  LitContractContext,
} from '@lit-protocol/types';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { ethers } from 'ethers';
import { AuthMethodScope, AuthMethodType } from '@lit-protocol/constants';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { createSiweMessage, craftAuthSig } from '@lit-protocol/auth-helpers';
// import { LocalStorage } from 'node-localstorage';
import { log } from '@lit-protocol/misc';
import { AuthSig } from '@lit-protocol/types';
import networkContext from './networkContext.json';
import { EthWalletProvider } from '@lit-protocol/lit-auth-client';

export enum ENV {
  LOCALCHAIN = 'localchain',
  HABANERO = 'habanero',
  MANZANO = 'manzano',
  CAYENNE = 'cayenne',
}
export type PKPInfo = {
  tokenId: string;
  publicKey: string;
  ethAddress: string;
};

export interface DevEnv {
  litNodeClient: LitNodeClient;
  litContractsClient: LitContracts;
  hotWallet: ethers.Wallet;
  hotWalletOwnedPkp: PKPInfo;
  hotWalletAuthSig: AuthSig;
  hotWalletAuthMethod: AuthMethod;
  hotWalletAuthMethodOwnedPkp: PKPInfo;
  lastestBlockhash: string;
  capacityTokenId: string;
  capacityDelegationAuthSig: AuthSig;
  capacityDelegationAuthSigWithPkp: AuthSig;
  toSignBytes32: Uint8Array;

  // All about Bob
  bobsWallet: ethers.Wallet;
  bobsOwnedPkp: PKPInfo;
  bobsContractsClient: LitContracts;
  bobsWalletAuthMethod: AuthMethod;
  bobsWalletAuthMethoedOwnedPkp: PKPInfo;
}

// ----- Test Configuration -----
export const getDevEnv = async (
  {
    env,
    debug,
  }: {
    env?: ENV;
    debug?: boolean;
  } = {
    env: ENV.LOCALCHAIN,
    debug: true,
  }
): Promise<DevEnv> => {
  log('🧪 [env-setup.ts] Starting devEnv');
  const PRIVATE_KEY =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const LIT_RPC_URL = 'http://127.0.0.1:8545';

  const BOOTSTRAP_URLS = [
    'http://127.0.0.1:7470',
    'http://127.0.0.1:7471',
    'http://127.0.0.1:7472',
  ];

  /**
   * ====================================
   * Setting up Lit Node Client
   * ====================================
   */
  log('🧪 [env-setup.ts] Setting up LitNodeClient');
  let litNodeClient: LitNodeClient;

  if (env === ENV.LOCALCHAIN) {
    litNodeClient = new LitNodeClient({
      litNetwork: 'custom',
      bootstrapUrls: BOOTSTRAP_URLS,
      rpcUrl: LIT_RPC_URL,
      debug,
      checkNodeAttestation: false, // disable node attestation check for local testing
      contractContext: networkContext as LitContractContext,
      // FIXME: When this  is not provided, we are having issues of verified siwe session key mistmatched with the
      // one being signed, because we generate a new session key again when we cannot find the storage provider.
      // storageProvider: {
      //   provider: new LocalStorage('./storage.test.db'),
      // },
    });
  } else if (env === ENV.HABANERO || env === ENV.MANZANO) {
    litNodeClient = new LitNodeClient({
      litNetwork: env, // 'habanero' or 'manzano'
      checkNodeAttestation: true,
      debug,

      // FIXME: When this  is not provided, we are having issues of verified siwe session key mistmatched with the
      // one being signed, because we generate a new session key again when we cannot find the storage provider.
      // storageProvider: {
      //   provider: new LocalStorage('./storage.test.db'),
      // },
    });
  } else {
    litNodeClient = new LitNodeClient({
      litNetwork: env,
      checkNodeAttestation: false,
      debug,
    });
  }

  await litNodeClient.connect();

  if (!litNodeClient.ready) {
    console.error('❌ litNodeClient not ready');
    process.exit();
  }

  /**
   * ====================================
   * Setup EOA Wallet using private key, and connects to LIT RPC URL
   * ====================================
   */
  log(
    '🧪 [env-setup.ts] Setup EOA Wallet using private key, and connects to LIT RPC URL'
  );
  let rpc: string;

  if (env === ENV.LOCALCHAIN) {
    rpc = LIT_RPC_URL;
  } else {
    rpc = 'https://chain-rpc.litprotocol.com/http';
  }
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  /**
   * ====================================
   * Get nonce from lit node
   * ====================================
   */
  log('🧪 [env-setup.ts] Get nonce from lit node');
  const nonce = await litNodeClient.getLatestBlockhash();

  /**
   * ====================================
   * Get Hot Wallet Auth Sig
   * ====================================
   */
  log('🧪 [env-setup.ts] Get Hot Wallet Auth Sig');
  const siweMessage = await createSiweMessage<BaseSiweMessage>({
    nonce,
    walletAddress: wallet.address,
  });

  log('🧪 [env-setup.ts] Crafting Auth Sig');
  const hotWalletAuthSig = await craftAuthSig({
    signer: wallet,
    toSign: siweMessage,
  });

  /**
   * ====================================
   * Craft an authMethod from the authSig for the eth wallet auth method
   * ====================================
   */

  log(
    '🧪 [env-setup.ts] Craft an authMethod from the authSig for the eth wallet auth method'
  );
  const hotWalletAuthMethod = {
    authMethodType: AuthMethodType.EthWallet,
    accessToken: JSON.stringify(hotWalletAuthSig),
  };

  /**
   * ====================================
   * Setup contracts-sdk client
   * ====================================
   */
  log('🧪 [env-setup.ts] Setting up contracts-sdk client');
  let litContractsClient: LitContracts;

  if (env === ENV.LOCALCHAIN) {
    litContractsClient = new LitContracts({
      signer: wallet,
      debug,
      rpc: LIT_RPC_URL, // anvil rpc
      customContext: networkContext as unknown as LitContractContext,
    });
  } else {
    litContractsClient = new LitContracts({
      signer: wallet,
      debug: false,
      network: env,
    });
  }

  await litContractsClient.connect();

  // (assert) check if contracts-sdk is connected
  if (!litContractsClient.connected) {
    console.error('❌ litContractsClient not connected');
    process.exit();
  }

  /**
   * ====================================
   * Mint a Capacity Credits NFT and get a capacity delegation authSig with it
   * ====================================
   */
  log(
    '🧪 [env-setup.ts] Mint a Capacity Credits NFT and get a capacity delegation authSig with it'
  );
  const { capacityTokenIdStr } =
    await litContractsClient.mintCapacityCreditsNFT({
      requestsPerDay: 14400, // 10 request per minute
      daysUntilUTCMidnightExpiration: 2,
    });

  log('🧪 [env-setup.ts] Creating a delegation auth sig');
  const { capacityDelegationAuthSig } =
    await litNodeClient.createCapacityDelegationAuthSig({
      uses: '1',
      dAppOwnerWallet: wallet,
      capacityTokenId: capacityTokenIdStr,
      delegateeAddresses: [wallet.address],
    });

  /**
   * ====================================
   * Mint a PKP
   * ====================================
   */
  log('🧪 [env-setup.ts] Mint a PKP');
  const mintRes = await litContractsClient.pkpNftContractUtils.write.mint();
  const hotWalletOwnedPkp = mintRes.pkp;

  /**
   * ====================================
   * Mint a PKP using the hot wallet auth method.
   * ====================================
   */
  log('🧪 [env-setup.ts] Mint a PKP using the hot wallet auth method');
  const mintWithAuthRes = await litContractsClient.mintWithAuth({
    authMethod: hotWalletAuthMethod,
    scopes: [AuthMethodScope.SignAnything],
  });

  let { pkp: hotWalletAuthMethodOwnedPkp } = mintWithAuthRes;

  /**
   * ====================================
   * Creates a Capacity Delegation AuthSig
   * that has PKP as one of the delegatees
   * ====================================
   */
  log(
    '🧪 [env-setup.ts] Creates a Capacity Delegation AuthSig that has PKP as one of the delegatees'
  );
  const { capacityDelegationAuthSig: capacityDelegationAuthSigWithPkp } =
    await litNodeClient.createCapacityDelegationAuthSig({
      uses: '1',
      dAppOwnerWallet: wallet,
      capacityTokenId: capacityTokenIdStr,
      delegateeAddresses: [hotWalletAuthMethodOwnedPkp.ethAddress],
    });

  /**
   * ====================================
   * A common toSign bytes32 for all signing tests
   * ====================================
   */
  const toSignBytes32 = ethers.utils.arrayify(
    ethers.utils.keccak256([1, 2, 3, 4, 5])
  );

  /**
   * ====================================
   * Bob's Wallet (Just another random wallet)
   * Usually used for capacity credits delegation
   * ====================================
   */
  const bobsPrivateKey =
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const bobsWallet = new ethers.Wallet(bobsPrivateKey, provider);

  /**
   * ====================================
   * Bob's Wallet Auth Method
   * ====================================
   */
  const bobsWalletAuthMethod = await EthWalletProvider.authenticate({
    signer: bobsWallet,
    litNodeClient,
  });

  /**
   * ====================================
   * Bobs mints a PKP
   * ====================================
   */
  log('🧪 [env-setup.ts] Bobs mints a PKP');
  let bobsContractsClient: LitContracts;

  if (env === ENV.LOCALCHAIN) {
    bobsContractsClient = new LitContracts({
      signer: bobsWallet,
      debug,
      rpc: LIT_RPC_URL, // anvil rpc
      customContext: networkContext as unknown as LitContractContext,
    });
  } else {
    bobsContractsClient = new LitContracts({
      signer: bobsWallet,
      debug: false,
      network: env,
    });
  }

  await bobsContractsClient.connect();

  const bobsMintRes =
    await bobsContractsClient.pkpNftContractUtils.write.mint();
  const bobsOwnedPkp = bobsMintRes.pkp;

  /**
   * ====================================
   * Bob mints a PKP using the hot wallet auth method.
   * ====================================
   */
  log('🧪 [env-setup.ts] Bob mints a PKP using the hot wallet auth method');
  const bobsMintWithAuthRes = await bobsContractsClient.mintWithAuth({
    authMethod: bobsWalletAuthMethod,
    scopes: [AuthMethodScope.SignAnything],
  });

  const bobsWalletAuthMethoedOwnedPkp = bobsMintWithAuthRes.pkp;

  log(`\n----- Development Environment Configuration -----
✅ Chain RPC URL: ${LIT_RPC_URL}
✅ Bootstrap URLs: ${BOOTSTRAP_URLS}
✅ Wallet Address: ${await wallet.getAddress()}
✅ Hot Wallet Auth Sig: ${JSON.stringify(hotWalletAuthSig)}
✅ Hot Wallet Owned PKP ${JSON.stringify(hotWalletOwnedPkp)}
✅ Hot Wallet Auth Method: ${JSON.stringify(hotWalletAuthMethod)}
✅ Hot Wallet Auth Method Owned PKP: ${JSON.stringify(
    hotWalletAuthMethodOwnedPkp
  )}
✅ Capacity Token ID: ${capacityTokenIdStr}
✅ Capacity Delegation Auth Sig: ${JSON.stringify(capacityDelegationAuthSig)}
✅ Capacity Delegation Auth Sig With PKP: ${JSON.stringify(
    capacityDelegationAuthSigWithPkp
  )}
✅ Bob's Wallet Address: ${await bobsWallet.getAddress()}
----- Test Starts Below -----
`);
  log('🧪 [env-setup.ts] End of devEnv');
  return {
    litNodeClient,
    litContractsClient,
    hotWallet: wallet,
    hotWalletAuthSig,
    hotWalletOwnedPkp,
    hotWalletAuthMethod,
    hotWalletAuthMethodOwnedPkp,
    lastestBlockhash: nonce,
    capacityTokenId: capacityTokenIdStr,
    capacityDelegationAuthSig,
    capacityDelegationAuthSigWithPkp,
    toSignBytes32,

    // All about Bob
    bobsWallet,
    bobsOwnedPkp,
    bobsContractsClient,
    bobsWalletAuthMethod,
    bobsWalletAuthMethoedOwnedPkp,
  };
};
