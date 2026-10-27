#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, BytesN, Env, Symbol};

#[test]
fn test_register_and_verify_proof_success() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1700000000);

    let contract_id = env.register(ProofAnchorContract, ());
    let client = ProofAnchorContractClient::new(&env, &contract_id);

    let issuer = Address::generate(&env);
    let proof_id = Symbol::new(&env, "PCA-TEST01");
    let content_hash = BytesN::from_array(&env, &[0x42; 32]);
    let metadata_hash = BytesN::from_array(&env, &[0x99; 32]);

    let record = client.register_proof(&issuer, &proof_id, &content_hash, &metadata_hash, &1);

    assert_eq!(record.proof_id, proof_id);
    assert_eq!(record.issuer, issuer);
    assert_eq!(record.content_hash, content_hash);
    assert_eq!(record.metadata_hash, metadata_hash);
    assert_eq!(record.timestamp, 1700000000);
    assert_eq!(record.version, 1);
    assert_eq!(record.revoked, false);
    assert_eq!(client.total_proofs(), 1);

    // Exact match verification succeeds
    let is_valid = client.verify_proof(&proof_id, &content_hash);
    assert!(is_valid);

    // Altered content hash verification fails
    let tampered_hash = BytesN::from_array(&env, &[0x77; 32]);
    let is_tampered_valid = client.verify_proof(&proof_id, &tampered_hash);
    assert!(!is_tampered_valid);
}

#[test]
fn test_reject_duplicate_registration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofAnchorContract, ());
    let client = ProofAnchorContractClient::new(&env, &contract_id);

    let issuer = Address::generate(&env);
    let proof_id = Symbol::new(&env, "PCA-DUP01");
    let hash1 = BytesN::from_array(&env, &[0x01; 32]);
    let meta1 = BytesN::from_array(&env, &[0x02; 32]);

    client.register_proof(&issuer, &proof_id, &hash1, &meta1, &1);

    // Attempting to register the same proof ID again must fail
    let res = client.try_register_proof(&issuer, &proof_id, &hash1, &meta1, &2);
    assert!(res.is_err());
}

#[test]
fn test_revoke_proof_by_issuer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofAnchorContract, ());
    let client = ProofAnchorContractClient::new(&env, &contract_id);

    let issuer = Address::generate(&env);
    let proof_id = Symbol::new(&env, "PCA-REVOKE");
    let content_hash = BytesN::from_array(&env, &[0x55; 32]);
    let metadata_hash = BytesN::from_array(&env, &[0x66; 32]);

    client.register_proof(&issuer, &proof_id, &content_hash, &metadata_hash, &1);
    assert!(client.verify_proof(&proof_id, &content_hash));

    // Revoke by issuer
    client.revoke_proof(&issuer, &proof_id);

    // After revocation, verification fails
    assert!(!client.verify_proof(&proof_id, &content_hash));

    // Record indicates revoked status
    let retrieved = client.get_proof(&proof_id).unwrap();
    assert!(retrieved.revoked);
}

#[test]
fn test_unknown_proof_verification_fails() {
    let env = Env::default();
    let contract_id = env.register(ProofAnchorContract, ());
    let client = ProofAnchorContractClient::new(&env, &contract_id);

    let fake_proof_id = Symbol::new(&env, "PCA-NONEXIST");
    let candidate = BytesN::from_array(&env, &[0x11; 32]);

    assert!(!client.verify_proof(&fake_proof_id, &candidate));
    assert!(client.get_proof(&fake_proof_id).is_none());
}
