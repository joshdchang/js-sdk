import {
  AccessControlConditions,
  ILitNodeClient,
  SessionSigsMap,
} from '@lit-protocol/types';

import { postLitActionValidation } from './utils';
import {
  EthereumLitTransaction,
  SerializedTransaction,
  StoredKeyMetadata,
} from '../types';

interface SignTransactionWithLitActionParams {
  litNodeClient: ILitNodeClient;
  pkpSessionSigs: SessionSigsMap;
  litActionIpfsCid: string;
  unsignedTransaction: EthereumLitTransaction | SerializedTransaction;
  storedKeyMetadata: StoredKeyMetadata;
  accessControlConditions: AccessControlConditions;
  broadcast: boolean;
}

export async function signTransactionWithLitAction({
  accessControlConditions,
  broadcast,
  litActionIpfsCid,
  litNodeClient,
  pkpSessionSigs,
  storedKeyMetadata: { ciphertext, dataToEncryptHash, pkpAddress },
  unsignedTransaction,
}: SignTransactionWithLitActionParams): Promise<string> {
  const result = await litNodeClient.executeJs({
    sessionSigs: pkpSessionSigs,
    ipfsId: litActionIpfsCid,
    jsParams: {
      pkpAddress,
      ciphertext,
      dataToEncryptHash,
      unsignedTransaction,
      broadcast,
      accessControlConditions,
    },
  });

  return postLitActionValidation(result);
}
