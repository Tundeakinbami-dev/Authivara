/**
 * Authivara — Live Stellar Testnet Verification Script
 *
 * This script demonstrates an end-to-end live proof registration and independent
 * verification against Stellar Testnet using official Stellar SDK and Horizon APIs.
 *
 * Usage:
 *   npx tsx scripts/verify-stellar-testnet.ts
 */

import { createHash, randomBytes } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarAnchorProvider } from '../apps/api/src/modules/blockchain/stellar.provider.js';

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

async function run() {
  console.log('='.repeat(70));
  console.log('  AUTHIVARA — LIVE STELLAR TESTNET ANCHORING & VERIFICATION');
  console.log('='.repeat(70));

  // 1. Generate ephemeral Testnet keypair
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  console.log(`\n[1] Generated Testnet Keypair:`);
  console.log(`    Public Key: ${publicKey}`);

  // 2. Fund account via Stellar Friendbot
  console.log(`\n[2] Requesting Friendbot funding from https://friendbot.stellar.org...`);
  const friendbotRes = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!friendbotRes.ok) {
    throw new Error(`Friendbot funding failed with status ${friendbotRes.status}`);
  }
  console.log('    ✓ Friendbot funding confirmed. Account activated on Stellar Testnet.');

  // 3. Initialize Stellar Anchor Provider
  const horizonUrl = 'https://horizon-testnet.stellar.org';
  const networkPassphrase = 'Test SDF Network ; September 2015';
  const provider = new StellarAnchorProvider({
    horizonUrl,
    networkPassphrase,
    anchorAccount: publicKey,
    anchorSecret: keypair.secret(),
  });

  // 4. Create document and compute deterministic fingerprint
  const documentContent = Buffer.from(
    `AUTHIVARA LIVE EVIDENCE SPECIFICATION — STELLAR WAVE PROGRAM 2026\nNonce: ${randomBytes(16).toString('hex')}\n`,
    'utf-8',
  );
  const documentFingerprint = sha256(documentContent);
  const proofId = `PCA-LIVE-${randomBytes(4).toString('hex').toUpperCase()}`;

  console.log(`\n[3] Document Fingerprint Generated:`);
  console.log(`    Proof ID:    ${proofId}`);
  console.log(`    SHA-256:     ${documentFingerprint}`);
  console.log(`    Byte Count:  ${documentContent.length} bytes (stored off-chain only)`);

  // 5. Submit anchor transaction to Stellar Testnet
  console.log(`\n[4] Submitting native manageData transaction to Stellar Testnet...`);
  const receipt = await provider.registerProof({
    proofId,
    contentHash: documentFingerprint,
    version: 1,
    timestamp: new Date().toISOString(),
  });

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${receipt.transactionHash}`;
  console.log('    ✓ Transaction Confirmed on Ledger!');
  console.log(`    Status:           ${receipt.status}`);
  console.log(`    Transaction Hash: ${receipt.transactionHash}`);
  console.log(`    Ledger Number:    ${receipt.blockNumber?.toString() ?? 'Pending'}`);
  console.log(`    StellarExpert:    ${explorerUrl}`);

  // 6. Independent verification of original document
  console.log(`\n[5] Executing independent verification query against Horizon...`);
  const originalCheck = await provider.verifyProof(documentFingerprint, receipt.transactionHash, proofId);
  console.log(`    Original Document Integrity: ${originalCheck ? '✓ MATCH (VERIFIED)' : '✗ FAILED'}`);

  // 7. Tamper detection verification
  const alteredDocument = Buffer.concat([documentContent, Buffer.from('TAMPERED BYTES')]);
  const alteredFingerprint = sha256(alteredDocument);
  const tamperedCheck = await provider.verifyProof(alteredFingerprint, receipt.transactionHash, proofId);
  console.log(`    Altered Document Integrity:  ${tamperedCheck ? '✗ INCORRECT MATCH' : '✓ TAMPER DETECTED (REJECTED)'}`);

  // 8. Summary
  console.log('\n' + '='.repeat(70));
  if (originalCheck && !tamperedCheck) {
    console.log('  RESULT: ALL STELLAR TESTNET ANCHORING & VERIFICATION CHECKS PASSED');
  } else {
    console.log('  RESULT: VERIFICATION FAILED');
  }
  console.log('='.repeat(70) + '\n');
}

run().catch((error) => {
  console.error('\n❌ Error during Stellar Testnet execution:', error);
  process.exit(1);
});
