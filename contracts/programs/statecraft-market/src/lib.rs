//! Statecraft Market — Parimutuel Betting Pool
//!
//! Spectators bet SOL on which country (AI agent) will win a Statecraft game.
//! All SOL in the pool is distributed proportionally to winners after settlement.
//!
//! Instructions:
//!   create_pool   — owner creates a new game pool (betting open)
//!   close_betting — owner closes betting (call when game starts)
//!   place_bet     — bettor sends SOL to back a country slot
//!   settle        — owner marks the winning country after game ends
//!   claim         — winner claims their proportional payout

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("REPLACE_WITH_PROGRAM_ID_AFTER_DEPLOY");

// ─── Sizes ───────────────────────────────────────────────────────────────────

impl GamePool {
    /// Maximum number of country slots supported by the on-chain account.
    pub const MAX_SLOTS: usize = 8;

    /// Byte length of a serialised GamePool (including 8-byte Anchor discriminator).
    pub const LEN: usize =
          8  // Anchor discriminator
        + 32 // owner: Pubkey
        + 32 // game_id: [u8; 32]
        + 1  // n_slots: u8
        + 1  // winning_slot: i8
        + 8  // total_lamports: u64
        + 8 * 8 // slot_totals: [u64; 8]
        + 1  // is_settled: bool
        + 1  // is_open: bool
        + 1; // bump: u8
}

impl Bet {
    /// Byte length of a serialised Bet (including 8-byte Anchor discriminator).
    pub const LEN: usize =
          8  // Anchor discriminator
        + 32 // pool: Pubkey
        + 32 // bettor: Pubkey
        + 1  // slot: u8
        + 8  // lamports: u64
        + 1  // claimed: bool
        + 1; // bump: u8
}

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod statecraft_market {
    use super::*;

    /// Create a new game pool. Betting is open immediately.
    ///
    /// # Arguments
    /// * `game_id` — 32-byte identifier for the game (e.g. sha256 of game UUID).
    /// * `n_slots` — number of competing countries (≤ 8; 5 for a standard game).
    pub fn create_pool(
        ctx: Context<CreatePool>,
        game_id: [u8; 32],
        n_slots: u8,
    ) -> Result<()> {
        require!(
            n_slots > 0 && n_slots as usize <= GamePool::MAX_SLOTS,
            StatecraftError::InvalidSlot
        );

        let pool = &mut ctx.accounts.pool;
        pool.owner = ctx.accounts.owner.key();
        pool.game_id = game_id;
        pool.n_slots = n_slots;
        pool.winning_slot = -1; // -1 = unsettled
        pool.total_lamports = 0;
        pool.slot_totals = [0u64; 8];
        pool.is_settled = false;
        pool.is_open = true;
        pool.bump = ctx.bumps.pool;

        msg!(
            "Pool created: game_id={:?} n_slots={}",
            &game_id[..8],
            n_slots
        );
        Ok(())
    }

    /// Close betting. Called by the owner when the game starts.
    /// No new bets will be accepted after this.
    pub fn close_betting(ctx: Context<CloseBetting>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_settled, StatecraftError::AlreadySettled);

        pool.is_open = false;
        msg!("Betting closed for pool {}", ctx.accounts.pool.key());
        Ok(())
    }

    /// Place (or add to) a bet on a country slot.
    ///
    /// # Arguments
    /// * `slot`     — country index (0 = first country, 1 = second, …).
    /// * `lamports` — amount of SOL to bet, in lamports (> 0).
    ///
    /// The bet account is created on first call and updated on subsequent calls.
    /// A bettor may not change their chosen slot.
    pub fn place_bet(ctx: Context<PlaceBet>, slot: u8, lamports: u64) -> Result<()> {
        // ── Validate pool state ────────────────────────────────────────────────
        require!(ctx.accounts.pool.is_open, StatecraftError::BettingClosed);
        require!(
            slot < ctx.accounts.pool.n_slots,
            StatecraftError::InvalidSlot
        );
        require!(lamports > 0, StatecraftError::InvalidSlot);

        // ── Validate / initialise bet ─────────────────────────────────────────
        // Detect whether this is the first bet (pool field will be default/zero).
        let bettor_key = ctx.accounts.bettor.key();
        let pool_key = ctx.accounts.pool.key();
        let is_new_bet = ctx.accounts.bet.pool == Pubkey::default();

        if is_new_bet {
            // First-time placement — initialise the bet account fields.
            let bet = &mut ctx.accounts.bet;
            bet.pool = pool_key;
            bet.bettor = bettor_key;
            bet.slot = slot;
            bet.claimed = false;
            bet.bump = ctx.bumps.bet;
        } else {
            // Subsequent placement — verify slot consistency and not claimed.
            require!(ctx.accounts.bet.slot == slot, StatecraftError::InvalidSlot);
            require!(!ctx.accounts.bet.claimed, StatecraftError::AlreadyClaimed);
        }

        // ── Transfer SOL from bettor to pool PDA (the vault) ─────────────────
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to: ctx.accounts.pool.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, lamports)?;

        // ── Update pool totals ────────────────────────────────────────────────
        let pool = &mut ctx.accounts.pool;
        pool.total_lamports = pool
            .total_lamports
            .checked_add(lamports)
            .ok_or(StatecraftError::InvalidSlot)?;
        pool.slot_totals[slot as usize] = pool.slot_totals[slot as usize]
            .checked_add(lamports)
            .ok_or(StatecraftError::InvalidSlot)?;

        // ── Update bet lamports ───────────────────────────────────────────────
        let bet = &mut ctx.accounts.bet;
        bet.lamports = bet
            .lamports
            .checked_add(lamports)
            .ok_or(StatecraftError::InvalidSlot)?;

        msg!(
            "Bet placed: bettor={} slot={} lamports={} (total_bet={})",
            bettor_key,
            slot,
            lamports,
            bet.lamports,
        );
        Ok(())
    }

    /// Settle the pool by recording the winning country.
    /// Automatically closes betting if it was still open.
    ///
    /// # Arguments
    /// * `winning_slot` — index of the winning country (must be < n_slots).
    pub fn settle(ctx: Context<Settle>, winning_slot: u8) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.is_settled, StatecraftError::AlreadySettled);
        require!(
            winning_slot < pool.n_slots,
            StatecraftError::InvalidSlot
        );

        pool.winning_slot = winning_slot as i8;
        pool.is_settled = true;
        pool.is_open = false; // Close betting in case it wasn't already closed.

        msg!(
            "Pool settled: winning_slot={} total_pot={} winner_pool={}",
            winning_slot,
            pool.total_lamports,
            pool.slot_totals[winning_slot as usize],
        );
        Ok(())
    }

    /// Claim a winning payout. Losers will receive an error (InvalidSlot).
    ///
    /// Payout = bet.lamports × total_pot / winner_pool
    /// where winner_pool = sum of all lamports bet on the winning slot.
    ///
    /// No house cut in V1 — 100% of the pool goes to winners.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        // ── Validate state ────────────────────────────────────────────────────
        require!(ctx.accounts.pool.is_settled, StatecraftError::NotSettled);
        require!(!ctx.accounts.bet.claimed, StatecraftError::AlreadyClaimed);

        let winning_slot = ctx.accounts.pool.winning_slot;
        // winning_slot is guaranteed ≥ 0 because is_settled = true implies it was set.
        require!(winning_slot >= 0, StatecraftError::NotSettled);
        let winning_slot = winning_slot as u8;

        // Verify the bettor backed the winning country.
        require!(
            ctx.accounts.bet.slot == winning_slot,
            StatecraftError::InvalidSlot
        );

        // ── Compute payout (u128 intermediary to prevent overflow) ────────────
        let bet_lamports = ctx.accounts.bet.lamports;
        let total_pot = ctx.accounts.pool.total_lamports;
        let winner_pool = ctx.accounts.pool.slot_totals[winning_slot as usize];

        // Guard against division by zero (should never happen if settle was valid).
        require!(winner_pool > 0, StatecraftError::NotSettled);

        let payout = (bet_lamports as u128)
            .checked_mul(total_pot as u128)
            .ok_or(StatecraftError::InvalidSlot)?
            .checked_div(winner_pool as u128)
            .ok_or(StatecraftError::InvalidSlot)? as u64;

        // ── Mark bet as claimed before transfer (reentrancy-safe ordering) ────
        ctx.accounts.bet.claimed = true;

        // ── Transfer payout: pool PDA → bettor ───────────────────────────────
        // Since our program owns the pool PDA, we can directly adjust lamports.
        {
            let pool_info = ctx.accounts.pool.to_account_info();
            let bettor_info = ctx.accounts.bettor.to_account_info();

            **pool_info.try_borrow_mut_lamports()? = pool_info
                .lamports()
                .checked_sub(payout)
                .ok_or(StatecraftError::InvalidSlot)?;

            **bettor_info.try_borrow_mut_lamports()? = bettor_info
                .lamports()
                .checked_add(payout)
                .ok_or(StatecraftError::InvalidSlot)?;
        }

        msg!(
            "Claim paid: bettor={} payout={} lamports",
            ctx.accounts.bettor.key(),
            payout,
        );
        Ok(())
    }
}

// ─── Accounts Contexts ────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(game_id: [u8; 32], n_slots: u8)]
pub struct CreatePool<'info> {
    /// The pool PDA — keyed by [b"pool", game_id].
    #[account(
        init,
        payer = owner,
        space = GamePool::LEN,
        seeds = [b"pool", game_id.as_ref()],
        bump,
    )]
    pub pool: Account<'info, GamePool>,

    /// Authority that will own and settle the pool.
    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseBetting<'info> {
    /// The pool must be owned by `owner` (enforced by `has_one`).
    #[account(
        mut,
        seeds = [b"pool", pool.game_id.as_ref()],
        bump = pool.bump,
        has_one = owner @ StatecraftError::Unauthorized,
    )]
    pub pool: Account<'info, GamePool>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(slot: u8, lamports: u64)]
pub struct PlaceBet<'info> {
    /// Pool vault — accumulates all bet lamports.
    #[account(
        mut,
        seeds = [b"pool", pool.game_id.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, GamePool>,

    /// One Bet PDA per (pool, bettor) pair.
    /// Created on first call, updated on subsequent calls.
    #[account(
        init_if_needed,
        payer = bettor,
        space = Bet::LEN,
        seeds = [b"bet", pool.key().as_ref(), bettor.key().as_ref()],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.game_id.as_ref()],
        bump = pool.bump,
        has_one = owner @ StatecraftError::Unauthorized,
    )]
    pub pool: Account<'info, GamePool>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    /// Pool vault — payout is drawn from here.
    #[account(
        mut,
        seeds = [b"pool", pool.game_id.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, GamePool>,

    /// The bettor's Bet account — must belong to this pool and bettor.
    #[account(
        mut,
        seeds = [b"bet", pool.key().as_ref(), bettor.key().as_ref()],
        bump = bet.bump,
        has_one = pool @ StatecraftError::Unauthorized,
        has_one = bettor @ StatecraftError::Unauthorized,
    )]
    pub bet: Account<'info, Bet>,

    /// Receives the payout.
    #[account(mut)]
    pub bettor: Signer<'info>,
}

// ─── State Accounts ───────────────────────────────────────────────────────────

/// On-chain state for a single game's betting pool.
///
/// PDA seeds: [b"pool", game_id]
#[account]
pub struct GamePool {
    /// Pubkey authorised to call close_betting, settle (and future admin ops).
    pub owner: Pubkey,
    /// 32-byte opaque identifier — typically sha256(game_uuid).
    pub game_id: [u8; 32],
    /// Number of competing country slots (max 8).
    pub n_slots: u8,
    /// -1 = unsettled; 0..n_slots-1 = winner index.
    pub winning_slot: i8,
    /// Running total of all lamports bet into this pool.
    pub total_lamports: u64,
    /// Per-slot totals (index 0..n_slots-1 are meaningful).
    pub slot_totals: [u64; 8],
    /// True once `settle` has been called.
    pub is_settled: bool,
    /// False after `close_betting` or `settle` is called.
    pub is_open: bool,
    /// Canonical bump seed for this PDA.
    pub bump: u8,
}

/// On-chain record of one bettor's position in a pool.
///
/// PDA seeds: [b"bet", pool_pubkey, bettor_pubkey]
#[account]
pub struct Bet {
    /// The pool this bet belongs to.
    pub pool: Pubkey,
    /// The bettor's wallet.
    pub bettor: Pubkey,
    /// Country slot index backed by this bet.
    pub slot: u8,
    /// Cumulative lamports placed by this bettor.
    pub lamports: u64,
    /// True once the winnings have been transferred out.
    pub claimed: bool,
    /// Canonical bump seed for this PDA.
    pub bump: u8,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum StatecraftError {
    /// Attempted to place a bet after betting was closed.
    #[msg("Betting is closed for this pool")]
    BettingClosed,

    /// Attempted to claim winnings that have already been claimed.
    #[msg("Winnings already claimed")]
    AlreadyClaimed,

    /// Attempted to claim before the pool has been settled.
    #[msg("Pool has not been settled yet")]
    NotSettled,

    /// Slot index is out of range, or bet amount is zero.
    #[msg("Invalid slot index or bet amount")]
    InvalidSlot,

    /// Attempted to settle a pool that has already been settled.
    #[msg("Pool has already been settled")]
    AlreadySettled,

    /// Caller is not the authorised owner of this pool.
    #[msg("Unauthorized: caller is not the pool owner")]
    Unauthorized,
}
