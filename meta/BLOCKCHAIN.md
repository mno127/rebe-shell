# Blockchain Alignment

**Purpose**: Document integration with Thing's Blockchain - the immutable source of truth for all Being and Doing

---

## Overview

Thing's Blockchain provides **cryptographic proofs** of all actions, decisions, and artifacts in the theCy+reBe ecosystem. It serves as the ultimate reference and contrast layer, ensuring immutability, traceability, and verifiability.

**Relationship to Versioning**:
- **Layer 1-4** (Git, Consul, Prometheus, Kafka): Mutable operational data
- **Layer 5** (Audit Log): Append-only operational decisions
- **Thing's Blockchain**: Immutable cryptographic proofs of Layer 5

---

## Architecture

### Thing's Blockchain Structure

**Block Components** (5±2 Rule Compliance):
1. **Block Header**: Metadata and hash pointers
2. **Transactions**: Proofs of Being and Doing
3. **State Root**: Merkle root of world state
4. **Consensus Proof**: Validator signatures
5. **Timestamp**: Verifiable temporal ordering

```
Block N:
{
  "header": {
    "block_number": N,
    "previous_hash": "0x...",
    "timestamp": "2025-10-20T18:00:00Z",
    "state_root": "0x...",
    "transactions_root": "0x..."
  },
  "transactions": [
    { "type": "CommandExecuted", "proof": "0x...", "data": {...} },
    { "type": "SessionCreated", "proof": "0x...", "data": {...} },
    { "type": "ConfigurationChanged", "proof": "0x...", "data": {...} }
  ],
  "consensus": {
    "validators": ["validator1", "validator2", "validator3"],
    "signatures": ["sig1", "sig2", "sig3"]
  }
}
```

---

## Transaction Types

### 1. Being Transactions
Record existence and state of entities:

```json
{
  "type": "EntityCreated",
  "timestamp": "2025-10-20T18:00:00Z",
  "entity": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "Session",
    "realm_id": "000001",
    "user_id": "dev1",
    "properties": {
      "conversation": "001-rebe-shell",
      "initial_state": "active"
    }
  },
  "proof": "0x1234abcd...",
  "previous_proof": null
}
```

### 2. Doing Transactions
Record actions and operations:

```json
{
  "type": "CommandExecuted",
  "timestamp": "2025-10-20T18:00:05Z",
  "action": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "dev1",
    "command": {
      "type": "system_info",
      "fields": ["hostname", "cpu_info"]
    },
    "execution": {
      "mode": "ssh",
      "host": "10.20.31.5",
      "duration_ms": 45,
      "status": "success"
    }
  },
  "proof": "0x5678efgh...",
  "previous_proof": "0x1234abcd..."
}
```

### 3. Decision Transactions
Record architectural and operational decisions:

```json
{
  "type": "ArchitectureDecisionMade",
  "timestamp": "2025-10-20T16:00:00Z",
  "decision": {
    "adr_number": "011",
    "title": "Pivot from Desktop to Web Architecture",
    "status": "Accepted",
    "supersedes": ["ADR-001"],
    "conversation_id": "001-rebe-shell",
    "decided_by": "DoG",
    "rationale_hash": "0xabcd1234..."
  },
  "proof": "0x9012ijkl...",
  "previous_proof": "0x5678efgh..."
}
```

### 4. Artifact Transactions
Record creation and deployment of artifacts:

```json
{
  "type": "ArtifactCreated",
  "timestamp": "2025-10-20T17:00:00Z",
  "artifact": {
    "type": "assembly",
    "name": "rebe-shell-backend",
    "version": "1.0.0",
    "hash": "sha256:abcd1234...",
    "conversation_id": "001-rebe-shell",
    "built_from": {
      "git_commit": "a1b2c3d4",
      "git_tag": "v1.0.0"
    }
  },
  "proof": "0x3456mnop...",
  "previous_proof": "0x9012ijkl..."
}
```

### 5. Governance Transactions
Record realm governance and policy changes:

```json
{
  "type": "PolicyEnacted",
  "timestamp": "2025-10-20T19:00:00Z",
  "policy": {
    "realm_id": "000001",
    "policy_type": "resource_allocation",
    "rules": {
      "max_cpu_per_user": "8 cores",
      "max_memory_per_user": "32 GB",
      "max_storage_per_user": "1 TB"
    },
    "effective_date": "2025-10-21T00:00:00Z"
  },
  "proof": "0x7890qrst...",
  "previous_proof": "0x3456mnop..."
}
```

---

## Proof Mechanism

### Hash Chain
Each transaction includes:
1. **Content Hash**: SHA-256 of transaction data
2. **Previous Proof**: Hash of previous transaction (chain linkage)
3. **Merkle Proof**: Position in transaction tree
4. **Block Proof**: Inclusion proof in block

```
Transaction N:
  content_hash = SHA256(transaction_data)
  previous_proof = transaction[N-1].proof
  proof = SHA256(content_hash || previous_proof || merkle_path || block_hash)
```

### Verification
Anyone can verify a transaction by:
1. Recomputing content hash
2. Verifying previous proof exists
3. Verifying Merkle proof against block root
4. Verifying block hash against chain

```rust
fn verify_transaction(tx: &Transaction, block: &Block) -> bool {
    // 1. Verify content hash
    let computed_hash = sha256(&tx.data);
    if computed_hash != tx.content_hash {
        return false;
    }

    // 2. Verify previous proof exists (if not genesis)
    if tx.previous_proof.is_some() {
        if !chain.contains(tx.previous_proof.unwrap()) {
            return false;
        }
    }

    // 3. Verify Merkle proof
    if !verify_merkle_proof(&tx.merkle_path, &block.transactions_root) {
        return false;
    }

    // 4. Verify block in chain
    chain.verify_block(block)
}
```

---

## Integration Points

### Layer 5 → Blockchain Bridge

**Process**:
1. Audit log entry created in PostgreSQL (Layer 5)
2. Entry batched with others (every 10 seconds or 100 entries)
3. Batch signed by DoG validator
4. Transaction submitted to Thing's Blockchain
5. Transaction confirmed and proof returned
6. Proof stored back in audit log

```rust
// Pseudocode for bridge
async fn sync_audit_to_blockchain(audit_entry: AuditEntry) -> Result<Proof> {
    // 1. Get pending entries
    let pending = audit_db.get_pending_entries().await?;

    // 2. Batch if enough
    if pending.len() >= 100 || last_sync > 10_seconds_ago {
        let batch = create_batch(pending);

        // 3. Sign batch
        let signature = dog_validator.sign(&batch).await?;

        // 4. Submit transaction
        let tx = Transaction::new(batch, signature);
        let proof = blockchain.submit(tx).await?;

        // 5. Store proof
        for entry in pending {
            audit_db.update_proof(entry.id, proof.clone()).await?;
        }

        Ok(proof)
    }
}
```

### Query Interface

**API Endpoints**:

```rust
// GET /blockchain/proof/{transaction_id}
// Returns: Proof and verification data
{
  "transaction_id": "tx_550e8400...",
  "proof": "0x1234abcd...",
  "block_number": 1234567,
  "block_hash": "0xabcd1234...",
  "timestamp": "2025-10-20T18:00:00Z",
  "verified": true
}

// GET /blockchain/verify/{proof}
// Returns: Verification result
{
  "proof": "0x1234abcd...",
  "valid": true,
  "transaction": {...},
  "block": {...},
  "verification_path": [...]
}

// GET /blockchain/history/{entity_id}
// Returns: Complete history of entity from blockchain
[
  {"timestamp": "...", "type": "EntityCreated", "proof": "..."},
  {"timestamp": "...", "type": "CommandExecuted", "proof": "..."},
  {"timestamp": "...", "type": "EntityUpdated", "proof": "..."}
]
```

---

## Consensus Mechanism

### Validator Set
Thing's Blockchain uses a **permissioned validator set** (5±2 rule compliance):

**Validators** (5 total):
1. **Primary DoG** (Distributed Observing Governor)
2. **Realm Validator 1** (elected by realms 000001-200000)
3. **Realm Validator 2** (elected by realms 200001-400000)
4. **Realm Validator 3** (elected by realms 400001-600000)
5. **Realm Validator 4** (elected by realms 600001-800000)
6. **Realm Validator 5** (elected by realms 800001-1000000)

**Note**: 6 validators (1 primary + 5 realm) - within 5±2 range

### Consensus Algorithm
**Byzantine Fault Tolerant (BFT)** consensus:
- Requires 2/3 + 1 signatures (5 of 6 validators)
- Block finality: 1-2 seconds
- Fork-free: No reorganization once confirmed

**Process**:
1. Primary DoG proposes block
2. Realm validators validate transactions
3. Validators sign block if valid
4. Once 5/6 signatures collected, block finalized
5. Block propagated to all nodes

---

## Use Cases

### 1. Audit Trail
**Scenario**: Compliance audit of user actions

**Process**:
1. Query audit log: "Show all commands by user dev1 on 2025-10-20"
2. Retrieve blockchain proofs for each entry
3. Verify proofs against blockchain
4. Present verified audit trail

**Guarantee**: Cannot be tampered with after the fact

---

### 2. Dispute Resolution
**Scenario**: User claims command was not executed

**Process**:
1. User provides session ID and timestamp
2. Query blockchain for transaction
3. If transaction exists with proof, command was executed
4. If transaction doesn't exist, command was not recorded

**Guarantee**: Verifiable truth of what happened

---

### 3. Rollback Verification
**Scenario**: System rolled back to previous version

**Process**:
1. Record rollback as decision transaction
2. Include proof of deployment that was rolled back
3. Include proof of version being restored
4. Future audits can trace why rollback occurred

**Guarantee**: Complete history of deployments and rollbacks

---

### 4. Resource Allocation Proof
**Scenario**: Realm claims it was allocated 100 nodes but only got 80

**Process**:
1. Query blockchain for resource allocation policy transaction
2. Query blockchain for actual resource allocation transaction
3. Compare committed allocation vs actual allocation
4. Verify both transactions with proofs

**Guarantee**: Verifiable resource commitments and fulfillment

---

### 5. Credential Verification
**Scenario**: Verify DoG is authorized to execute privileged operation

**Process**:
1. DoG submits operation with signature
2. System verifies signature against DoG's public key
3. System queries blockchain for DoG's authorization transaction
4. If authorization exists with proof, operation allowed

**Guarantee**: Cryptographic proof of authorization

---

## Security Properties

### Immutability
- Once written to blockchain, transaction cannot be altered
- Attempting to alter would change proof hash
- Changed hash would fail verification against block root

### Non-Repudiation
- All transactions signed by validator set
- Cannot deny participation in consensus
- Signatures verifiable with public keys

### Auditability
- Complete history preserved forever
- Any party can verify any transaction
- Temporal ordering guaranteed by block sequence

### Transparency
- All transactions visible to authorized parties
- Proofs can be verified independently
- No hidden operations

### Tamper-Evidence
- Any alteration breaks hash chain
- Broken chain immediately detectable
- Cannot silently modify history

---

## Migration Strategy

### Phase 1: Audit Log Only (Current)
- PostgreSQL audit tables (Layer 5)
- No blockchain integration yet
- Preparation for future integration

### Phase 2: Blockchain Bridge (Months 6-9)
- Deploy Thing's Blockchain infrastructure
- Implement bridge service
- Start syncing audit entries to blockchain
- Proofs stored in audit tables

### Phase 3: Full Integration (Months 9-12)
- All critical operations recorded on blockchain
- Real-time proof verification
- Blockchain as authoritative source for disputes
- UI showing blockchain proofs

### Phase 4: Public Verification (Months 12+)
- Public blockchain explorer
- Anyone can verify transactions
- Realm-level access controls
- Complete transparency with privacy

---

## References

- **Related Meta Docs**: VERSIONING.md (Layer 5), CONVERSATIONS.md, ARTIFACTS.md
- **Conversation Docs**: conversations/001-rebe-shell/ARCHITECTURE.md
- **External**: [Thing's Blockchain Documentation](#) (TBD)

---

**Last Updated**: 2025-10-20
**Version**: 1.0
**Status**: Living document
