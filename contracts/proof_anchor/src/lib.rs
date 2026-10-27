#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ProofError {
    AlreadyRegistered = 1,
    ProofNotFound = 2,
    Unauthorized = 3,
    AlreadyRevoked = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofRecord {
    pub proof_id: Symbol,
    pub issuer: Address,
    pub content_hash: BytesN<32>,
    pub metadata_hash: BytesN<32>,
    pub timestamp: u64,
    pub version: u32,
    pub revoked: bool,
}

#[contracttype]
pub enum DataKey {
    Proof(Symbol),
    TotalRegistered,
}

#[contract]
pub struct ProofAnchorContract;

#[contractimpl]
impl ProofAnchorContract {
    /// Registers a cryptographic proof of content authorship.
    /// Requires authorization from the issuing account.
    /// Stores the SHA-256 content digest and canonical metadata hash.
    pub fn register_proof(
        env: Env,
        issuer: Address,
        proof_id: Symbol,
        content_hash: BytesN<32>,
        metadata_hash: BytesN<32>,
        version: u32,
    ) -> Result<ProofRecord, ProofError> {
        issuer.require_auth();

        let key = DataKey::Proof(proof_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(ProofError::AlreadyRegistered);
        }

        let timestamp = env.ledger().timestamp();
        let record = ProofRecord {
            proof_id: proof_id.clone(),
            issuer: issuer.clone(),
            content_hash,
            metadata_hash,
            timestamp,
            version,
            revoked: false,
        };

        // Store proof with persistent storage and extend TTL
        env.storage().persistent().set(&key, &record);
        env.storage().persistent().extend_ttl(&key, 17280, 518400); // 30-day base, up to 180 days

        let total_key = DataKey::TotalRegistered;
        let total: u64 = env.storage().instance().get(&total_key).unwrap_or(0);
        env.storage().instance().set(&total_key, &(total + 1));

        // Publish registration event for indexers
        env.events().publish((symbol_short!("registered"), issuer, proof_id), timestamp);

        Ok(record)
    }

    /// Retrieves an existing proof record by Proof ID.
    pub fn get_proof(env: Env, proof_id: Symbol) -> Option<ProofRecord> {
        let key = DataKey::Proof(proof_id);
        env.storage().persistent().get(&key)
    }

    /// Verifies if a given content hash matches the recorded proof.
    /// Returns true if the proof exists, is not revoked, and matches the content hash.
    pub fn verify_proof(env: Env, proof_id: Symbol, candidate_hash: BytesN<32>) -> bool {
        let key = DataKey::Proof(proof_id);
        match env.storage().persistent().get::<DataKey, ProofRecord>(&key) {
            Some(record) => !record.revoked && record.content_hash == candidate_hash,
            None => false,
        }
    }

    /// Revokes a previously registered proof.
    /// Can only be invoked by the original issuer.
    pub fn revoke_proof(env: Env, issuer: Address, proof_id: Symbol) -> Result<(), ProofError> {
        issuer.require_auth();

        let key = DataKey::Proof(proof_id.clone());
        let mut record: ProofRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ProofError::ProofNotFound)?;

        if record.issuer != issuer {
            return Err(ProofError::Unauthorized);
        }
        if record.revoked {
            return Err(ProofError::AlreadyRevoked);
        }

        record.revoked = true;
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            (symbol_short!("revoked"), issuer, proof_id),
            env.ledger().timestamp(),
        );

        Ok(())
    }

    /// Returns the total number of proofs registered in this contract instance.
    pub fn total_proofs(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::TotalRegistered).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
