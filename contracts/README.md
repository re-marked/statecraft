# statecraft-market

Parimutuel betting pool smart contract for **Statecraft** — spectators bet SOL on which AI-controlled country will win a game. The entire pool is redistributed proportionally to winners (no house cut in V1).

---

## Architecture

### Accounts

| Account | PDA Seeds | Description |
|---------|-----------|-------------|
| `GamePool` | `["pool", game_id]` | Pool state + SOL vault |
| `Bet` | `["bet", pool_pubkey, bettor_pubkey]` | One bet per bettor per pool |

### Instructions

| Instruction | Who calls it | Description |
|-------------|-------------|-------------|
| `create_pool(game_id, n_slots)` | Owner | Creates pool, opens betting |
| `close_betting()` | Owner | Stops accepting new bets (call at game start) |
| `place_bet(slot, lamports)` | Anyone | Bet SOL on a country slot |
| `settle(winning_slot)` | Owner | Record winner after game ends |
| `claim()` | Winning bettor | Withdraw proportional payout |

### Payout Math

```
winner_pool = sum of all lamports bet on winning slot
payout      = bet.lamports × total_pot / winner_pool
```

Example: 10 SOL total pool, France wins with 5 SOL backed:
- Alice (3 SOL on France) → receives 3 × 10 / 5 = **6 SOL**
- Bob   (2 SOL on France) → receives 2 × 10 / 5 = **4 SOL**
- Charlie (5 SOL on Germany) → receives **0 SOL**

---

## Windows Linker Fix (if needed)

If `cargo check` fails with `link: extra operand` on Windows, Git's `link.exe` is shadowing the MSVC linker. Fix it by temporarily prepending the MSVC tools to PATH, or just use `anchor build` directly (it uses its own BPF LLVM toolchain and bypasses this entirely).

```powershell
# Option A: use anchor build (recommended — no host linker needed)
anchor build

# Option B: fix the PATH conflict
$env:PATH = "C:\Program Files\Microsoft Visual Studio\2022\...\VC\Tools\MSVC\...\bin\Hostx64\x64;" + $env:PATH
```

---

## Prerequisites

### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add bpfel-unknown-unknown
```

### Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
# or on Windows via scoop / manual download
```

### Install Anchor CLI (AVM)
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1
avm use 0.30.1
anchor --version   # should show 0.30.1
```

### Install Node / Yarn (for tests)
```bash
npm install -g yarn
yarn install       # inside contracts/
```

---

## Build

```bash
cd C:\Users\psyhik1769\statecraft\contracts
anchor build
```

After build, the compiled `.so` is at:
```
target/deploy/statecraft_market.so
```

The IDL (ABI) is at:
```
target/idl/statecraft_market.json
```

---

## Deploy

### Step 1 — Generate a program keypair (one-time)

```bash
solana-keygen new -o target/deploy/statecraft-market-keypair.json
```

This gives you the **program ID**. Print it:
```bash
solana address -k target/deploy/statecraft-market-keypair.json
```

### Step 2 — Replace the placeholder program ID

In `programs/statecraft-market/src/lib.rs`, replace:
```rust
declare_id!("REPLACE_WITH_PROGRAM_ID_AFTER_DEPLOY");
```
with your actual program ID.

In `Anchor.toml`, replace all `REPLACE_WITH_PROGRAM_ID_AFTER_DEPLOY` with the same ID.

### Step 3 — Rebuild

```bash
anchor build
```

### Step 4 — Deploy to Devnet

```bash
solana config set --url devnet
solana airdrop 2    # fund your deployer wallet
anchor deploy --provider.cluster devnet
```

Verify deployment:
```bash
solana program show <PROGRAM_ID> --url devnet
```

### Step 5 — Deploy to Mainnet-Beta

```bash
# Make sure your wallet has enough SOL (check with `solana balance --url mainnet-beta`)
anchor deploy --provider.cluster mainnet-beta
```

> **Note:** Deploying a 200KB+ BPF program costs ~3–4 SOL on mainnet. Use `solana program deploy --max-sign-attempts 10` if you hit rate limits.

---

## Run Tests

Tests run against a local validator spun up by Anchor:

```bash
anchor test
```

To run against an already-running local validator:
```bash
solana-test-validator &
anchor test --skip-local-validator
```

---

## Client Integration

### Finding PDAs (TypeScript)

```typescript
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("<YOUR_PROGRAM_ID>");

// Game pool PDA
const gameId = Buffer.alloc(32);
Buffer.from("my-game-uuid-here").copy(gameId);

const [poolPda, poolBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("pool"), gameId],
  PROGRAM_ID
);

// Bet PDA for a specific bettor
const [betPda, betBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("bet"), poolPda.toBuffer(), bettorPublicKey.toBuffer()],
  PROGRAM_ID
);
```

### Create a Pool

```typescript
await program.methods
  .createPool(Array.from(gameId), 5)   // 5 countries
  .accounts({
    pool: poolPda,
    owner: ownerKeypair.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([ownerKeypair])
  .rpc();
```

### Place a Bet

```typescript
await program.methods
  .placeBet(0, new anchor.BN(1_000_000_000))  // slot 0 = France, 1 SOL
  .accounts({
    pool: poolPda,
    bet: betPda,
    bettor: bettorKeypair.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([bettorKeypair])
  .rpc();
```

### Settle

```typescript
await program.methods
  .settle(0)   // France (slot 0) wins
  .accounts({
    pool: poolPda,
    owner: ownerKeypair.publicKey,
  })
  .signers([ownerKeypair])
  .rpc();
```

### Claim

```typescript
await program.methods
  .claim()
  .accounts({
    pool: poolPda,
    bet: betPda,
    bettor: bettorKeypair.publicKey,
  })
  .signers([bettorKeypair])
  .rpc();
```

---

## Country Slot Mapping (off-chain)

The contract is slot-index agnostic. Slot → country mapping lives off-chain:

```typescript
// Example for a 5-country game
const COUNTRIES = ["France", "Germany", "UK", "Japan", "USA"];
// slot 0 = France, slot 1 = Germany, etc.
```

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | `BettingClosed` | Pool is no longer accepting bets |
| 6001 | `AlreadyClaimed` | Winnings already withdrawn |
| 6002 | `NotSettled` | Pool not yet settled |
| 6003 | `InvalidSlot` | Slot out of range, wrong slot, or zero bet |
| 6004 | `AlreadySettled` | Pool already settled |
| 6005 | `Unauthorized` | Caller is not pool owner |

---

## V2 Roadmap

- [ ] House fee (1–2% cut swept to a treasury wallet)
- [ ] `close_pool` instruction to reclaim pool-account rent after all claims
- [ ] Multi-sig owner (Squads) for mainnet
- [ ] Refund instruction for cancelled games
- [ ] Frontend UI (React + `@coral-xyz/anchor`)
- [ ] Pyth oracle integration for game result verification

---

## Security Notes

- **Owner key**: In V1 the owner is a single keypair. On mainnet, consider upgrading to a Squads multisig.
- **Settlement trust**: The owner's word is trusted for the winning slot. V2 could use an oracle or a DAO vote.
- **Integer math**: Payout uses `u128` intermediate multiplication to prevent overflow on large pools.
- **Re-initialisation**: `init_if_needed` is used for bet accounts; the PDA binding (pool + bettor) prevents account hijacking.
