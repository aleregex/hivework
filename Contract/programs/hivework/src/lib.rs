use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod constants;
pub mod errors;
pub mod events;
pub mod state;

use constants::*;
use errors::*;
use events::*;
use state::*;

declare_id!("8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8");

/// ln(2) × 10000, usado para convertir log2(x) a ln(x).
const LN2_X10000: u64 = 6931;

/// Aproxima ln(forks + 1) escalado por 10000.
/// Usa ilog2 (entero) y multiplica por ln(2). Es una cota inferior a la real,
/// pero monotónica creciente, suficiente para una fórmula de pesos relativos.
fn ln_x10000(forks_plus_one: u64) -> u64 {
    if forks_plus_one <= 1 {
        return 0;
    }
    (forks_plus_one.ilog2() as u64) * LN2_X10000
}

/// richness = min(bytes_metadata / 1000, 1.0), escalado por 10000 → 0..10000.
fn richness_x10000(bytes_metadata: u32) -> u64 {
    let capped = (bytes_metadata as u64).min(1000);
    capped * 10
}

/// position_factor escalado por 10000.
/// constants.rs guarda factor × 10 (L1=10, L2=7, L3=5, leaf=3); aquí × 1000 más.
fn position_x10000(level_pos_x10: u8) -> u64 {
    (level_pos_x10 as u64) * 1000
}

/// Fórmula del spec: peso = α·log(forks+1) + β·richness + γ·position.
/// Devuelve un peso en unidades arbitrarias (el ratio importa, no el absoluto).
fn calc_weight(
    forks: u32,
    bytes_metadata: u32,
    level_pos_x10: u8,
    alpha_pct: u8,
    beta_pct: u8,
    gamma_pct: u8,
) -> u64 {
    let log_term = ln_x10000((forks as u64).saturating_add(1));
    let rich_term = richness_x10000(bytes_metadata);
    let pos_term = position_x10000(level_pos_x10);
    (alpha_pct as u64) * log_term
        + (beta_pct as u64) * rich_term
        + (gamma_pct as u64) * pos_term
}

#[program]
pub mod hivework {
    use super::*;

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        deadline: i64,
        alpha_weight: u8,
        beta_weight: u8,
        gamma_weight: u8,
        campaign_id: u32,
        initial_usdc: u64,
        metadata_cuid: String,
    ) -> Result<()> {
        require!(metadata_cuid.len() <= MAX_CUID_LEN, HiveworkError::DataTooLarge);
        require!(
            (alpha_weight as u16) + (beta_weight as u16) + (gamma_weight as u16) == 100,
            HiveworkError::InvalidWeights
        );
        let clock = Clock::get()?;
        require!(deadline > clock.unix_timestamp, HiveworkError::InvalidDeadline);
        require!(initial_usdc > 0, HiveworkError::InsufficientFunds);

        let cpi_accounts = Transfer {
            from: ctx.accounts.authority_usdc.to_account_info(),
            to: ctx.accounts.escrow_usdc.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
        token::transfer(cpi_ctx, initial_usdc)?;

        let campaign = &mut ctx.accounts.campaign;
        campaign.authority = ctx.accounts.authority.key();
        campaign.id = campaign_id;
        campaign.escrow_usdc = ctx.accounts.escrow_usdc.key();
        campaign.usdc_mint = ctx.accounts.usdc_mint.key();
        campaign.oracle_authority = ctx.accounts.oracle_authority.key();
        campaign.total_usdc = initial_usdc;
        campaign.platform_fee = PLATFORM_FEE_PERCENTAGE;
        campaign.alpha_weight = alpha_weight;
        campaign.beta_weight = beta_weight;
        campaign.gamma_weight = gamma_weight;
        campaign.deadline = deadline;
        campaign.is_closed = false;
        campaign.conversions_processed = 0;
        campaign.total_conversions = 0;
        campaign.forfeited_pool = 0;
        campaign.total_to_winners = 0;
        campaign.unused_withdrawn = false;
        campaign.bump = ctx.bumps.campaign;

        emit!(CampaignCreated {
            campaign: campaign.key(),
            authority: campaign.authority,
            total_usdc: campaign.total_usdc,
            deadline: campaign.deadline,
            metadata_cuid,
        });

        Ok(())
    }

    pub fn create_node(
        ctx: Context<CreateNode>,
        level: u8,
        metadata_hash: [u8; 32],
        bytes_metadata: u32,
        metadata_cuid: String,
    ) -> Result<()> {
        require!(metadata_cuid.len() <= MAX_CUID_LEN, HiveworkError::DataTooLarge);
        require!(!ctx.accounts.campaign.is_closed, HiveworkError::CampaignClosed);
        require!((1..=3).contains(&level), HiveworkError::InvalidLevel);

        let required_stake = match level {
            1 => L1_STAKE_AMOUNT,
            2 => L2_STAKE_AMOUNT,
            3 => L3_STAKE_AMOUNT,
            _ => return err!(HiveworkError::InvalidLevel),
        };

        let node = &mut ctx.accounts.node;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: node.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, required_stake)?;

        node.campaign = ctx.accounts.campaign.key();
        node.creator = ctx.accounts.creator.key();
        node.level = level;
        node.metadata_hash = metadata_hash;
        node.bytes_metadata = bytes_metadata;
        node.stake_locked = required_stake;
        node.forks_count = 0;
        node.conversions_count = 0;
        node.claimable_usdc = 0;
        node.bump = ctx.bumps.node;

        if level == 1 {
            node.parent_node = None;
        } else {
            let parent = ctx
                .accounts
                .parent_node
                .as_mut()
                .ok_or(HiveworkError::InvalidParentNode)?;
            require!(parent.level == level - 1, HiveworkError::InvalidParentNode);
            require!(
                parent.campaign == ctx.accounts.campaign.key(),
                HiveworkError::InvalidParentNode
            );
            node.parent_node = Some(parent.key());
            parent.forks_count = parent.forks_count.checked_add(1).unwrap();
        }

        emit!(NodeCreated {
            node: node.key(),
            campaign: node.campaign,
            creator: node.creator,
            level: node.level,
            parent_node: node.parent_node,
            stake_lamports: node.stake_locked,
            metadata_cuid,
        });

        Ok(())
    }

    pub fn create_leaf(
        ctx: Context<CreateLeaf>,
        ref_code: [u8; 8],
        bytes_metadata: u32,
        metadata_cuid: String,
    ) -> Result<()> {
        require!(metadata_cuid.len() <= MAX_CUID_LEN, HiveworkError::DataTooLarge);
        require!(!ctx.accounts.campaign.is_closed, HiveworkError::CampaignClosed);

        require!(ctx.accounts.node_l1.level == 1, HiveworkError::InvalidGenealogicalPath);
        require!(ctx.accounts.node_l2.level == 2, HiveworkError::InvalidGenealogicalPath);
        require!(ctx.accounts.node_l3.level == 3, HiveworkError::InvalidGenealogicalPath);
        require!(
            ctx.accounts.node_l3.parent_node == Some(ctx.accounts.node_l2.key()),
            HiveworkError::InvalidGenealogicalPath
        );
        require!(
            ctx.accounts.node_l2.parent_node == Some(ctx.accounts.node_l1.key()),
            HiveworkError::InvalidGenealogicalPath
        );
        let campaign_key = ctx.accounts.campaign.key();
        require!(
            ctx.accounts.node_l1.campaign == campaign_key
                && ctx.accounts.node_l2.campaign == campaign_key
                && ctx.accounts.node_l3.campaign == campaign_key,
            HiveworkError::InvalidGenealogicalPath
        );

        let leaf = &mut ctx.accounts.leaf;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: leaf.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, LEAF_STAKE_AMOUNT)?;

        leaf.campaign = campaign_key;
        leaf.creator = ctx.accounts.creator.key();
        leaf.parent_node = ctx.accounts.node_l3.key();
        leaf.ref_code = ref_code;
        leaf.bytes_metadata = bytes_metadata;
        leaf.stake_locked = LEAF_STAKE_AMOUNT;
        leaf.conversions_count = 0;
        leaf.claimable_usdc = 0;
        leaf.redistribution_claimed = false;
        leaf.bump = ctx.bumps.leaf;

        leaf.genealogical_path = [
            ctx.accounts.node_l1.key(),
            ctx.accounts.node_l2.key(),
            ctx.accounts.node_l3.key(),
        ];

        emit!(LeafCreated {
            leaf: leaf.key(),
            campaign: leaf.campaign,
            creator: leaf.creator,
            ref_code: leaf.ref_code,
            path: leaf.genealogical_path,
            stake_lamports: leaf.stake_locked,
            metadata_cuid,
        });

        Ok(())
    }

    pub fn register_conversion(
        ctx: Context<RegisterConversion>,
        conversion_id: [u8; 16],
        value: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.campaign.is_closed, HiveworkError::CampaignClosed);
        let campaign_key = ctx.accounts.campaign.key();
        require!(
            ctx.accounts.leaf.campaign == campaign_key,
            HiveworkError::InvalidGenealogicalPath
        );
        require!(
            ctx.accounts.leaf.genealogical_path[0] == ctx.accounts.node_l1.key()
                && ctx.accounts.leaf.genealogical_path[1] == ctx.accounts.node_l2.key()
                && ctx.accounts.leaf.genealogical_path[2] == ctx.accounts.node_l3.key(),
            HiveworkError::InvalidGenealogicalPath
        );

        let conversion = &mut ctx.accounts.conversion;
        conversion.campaign = campaign_key;
        conversion.leaf = ctx.accounts.leaf.key();
        conversion.oracle = ctx.accounts.oracle.key();
        conversion.id = conversion_id;
        conversion.value = value;
        conversion.is_processed = false;
        conversion.bump = ctx.bumps.conversion;

        ctx.accounts.leaf.conversions_count =
            ctx.accounts.leaf.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l3.conversions_count =
            ctx.accounts.node_l3.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l2.conversions_count =
            ctx.accounts.node_l2.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l1.conversions_count =
            ctx.accounts.node_l1.conversions_count.checked_add(1).unwrap();

        ctx.accounts.campaign.total_conversions = ctx
            .accounts
            .campaign
            .total_conversions
            .checked_add(1)
            .unwrap();

        emit!(ConversionRegistered {
            conversion: conversion.key(),
            campaign: conversion.campaign,
            leaf: conversion.leaf,
            value: conversion.value,
            conversion_id,
        });

        Ok(())
    }

    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        let clock = Clock::get()?;
        let campaign = &mut ctx.accounts.campaign;
        require!(
            clock.unix_timestamp >= campaign.deadline || campaign.is_closed,
            HiveworkError::CampaignNotClosed
        );

        if !campaign.is_closed {
            campaign.is_closed = true;
            emit!(CampaignClosed {
                campaign: campaign.key(),
                conversions_processed: campaign.conversions_processed,
            });
        }

        Ok(())
    }

    pub fn close_and_distribute(ctx: Context<CloseAndDistribute>) -> Result<()> {
        let clock = Clock::get()?;
        let campaign = &mut ctx.accounts.campaign;
        require!(
            clock.unix_timestamp >= campaign.deadline || campaign.is_closed,
            HiveworkError::CampaignNotClosed
        );

        if !campaign.is_closed {
            campaign.is_closed = true;
            emit!(CampaignClosed {
                campaign: campaign.key(),
                conversions_processed: campaign.conversions_processed,
            });
        }

        let conversion = &mut ctx.accounts.conversion;
        require!(
            !conversion.is_processed,
            HiveworkError::ConversionAlreadyRegistered
        );
        require!(
            conversion.campaign == campaign.key(),
            HiveworkError::InvalidGenealogicalPath
        );
        require!(
            conversion.leaf == ctx.accounts.leaf.key(),
            HiveworkError::InvalidGenealogicalPath
        );
        require!(
            ctx.accounts.leaf.genealogical_path[0] == ctx.accounts.node_l1.key()
                && ctx.accounts.leaf.genealogical_path[1] == ctx.accounts.node_l2.key()
                && ctx.accounts.leaf.genealogical_path[2] == ctx.accounts.node_l3.key(),
            HiveworkError::InvalidGenealogicalPath
        );

        let alpha = campaign.alpha_weight;
        let beta = campaign.beta_weight;
        let gamma = campaign.gamma_weight;

        let w_l1 = calc_weight(
            ctx.accounts.node_l1.forks_count,
            ctx.accounts.node_l1.bytes_metadata,
            POS_FACTOR_L1,
            alpha,
            beta,
            gamma,
        );
        let w_l2 = calc_weight(
            ctx.accounts.node_l2.forks_count,
            ctx.accounts.node_l2.bytes_metadata,
            POS_FACTOR_L2,
            alpha,
            beta,
            gamma,
        );
        let w_l3 = calc_weight(
            ctx.accounts.node_l3.forks_count,
            ctx.accounts.node_l3.bytes_metadata,
            POS_FACTOR_L3,
            alpha,
            beta,
            gamma,
        );
        // El leaf no tiene forks descendientes
        let w_leaf = calc_weight(
            0,
            ctx.accounts.leaf.bytes_metadata,
            POS_FACTOR_LEAF,
            alpha,
            beta,
            gamma,
        );

        let total_weight = (w_l1 as u128)
            + (w_l2 as u128)
            + (w_l3 as u128)
            + (w_leaf as u128);
        require!(total_weight > 0, HiveworkError::MathError);

        // Compute payouts in u128 to avoid overflow when conversion.value and
        // the weights are both large. Final per-recipient amounts always fit
        // back into u64 because they're bounded by conversion.value (u64).
        let value_u128 = conversion.value as u128;
        let fee = value_u128
            .checked_mul(campaign.platform_fee as u128)
            .ok_or_else(|| error!(HiveworkError::MathError))?
            / 100;
        let distributable = value_u128
            .checked_sub(fee)
            .ok_or_else(|| error!(HiveworkError::MathError))?;

        let leaf_bonus = distributable
            .checked_mul(LEAF_BONUS_PERCENTAGE as u128)
            .ok_or_else(|| error!(HiveworkError::MathError))?
            / 100;
        let shared_pool = distributable
            .checked_sub(leaf_bonus)
            .ok_or_else(|| error!(HiveworkError::MathError))?;

        let share = |w: u128| -> Result<u64> {
            let s = shared_pool
                .checked_mul(w)
                .ok_or_else(|| error!(HiveworkError::MathError))?
                / total_weight;
            u64::try_from(s).map_err(|_| error!(HiveworkError::MathError))
        };

        let l1_share = share(w_l1 as u128)?;
        let l2_share = share(w_l2 as u128)?;
        let l3_share = share(w_l3 as u128)?;
        let leaf_share_base = share(w_leaf as u128)?;
        let leaf_bonus_u64 =
            u64::try_from(leaf_bonus).map_err(|_| error!(HiveworkError::MathError))?;
        let leaf_share = leaf_share_base
            .checked_add(leaf_bonus_u64)
            .ok_or_else(|| error!(HiveworkError::MathError))?;

        ctx.accounts.node_l1.claimable_usdc = ctx
            .accounts
            .node_l1
            .claimable_usdc
            .saturating_add(l1_share);
        ctx.accounts.node_l2.claimable_usdc = ctx
            .accounts
            .node_l2
            .claimable_usdc
            .saturating_add(l2_share);
        ctx.accounts.node_l3.claimable_usdc = ctx
            .accounts
            .node_l3
            .claimable_usdc
            .saturating_add(l3_share);
        ctx.accounts.leaf.claimable_usdc = ctx
            .accounts
            .leaf
            .claimable_usdc
            .saturating_add(leaf_share);

        // Tracking total asignado a ganadores → permite a la marca retirar el remanente
        let allocated = l1_share
            .saturating_add(l2_share)
            .saturating_add(l3_share)
            .saturating_add(leaf_share);
        campaign.total_to_winners = campaign.total_to_winners.saturating_add(allocated);

        conversion.is_processed = true;
        campaign.conversions_processed = campaign.conversions_processed.checked_add(1).unwrap();

        Ok(())
    }

    /// Mueve el stake de un nodo perdedor (sin conversiones) al pool de la campaña.
    /// Solo callable después de cerrar. Cualquiera puede llamarla — es trabajo público.
    pub fn forfeit_node_stake(ctx: Context<ForfeitNodeStake>) -> Result<()> {
        require!(ctx.accounts.campaign.is_closed, HiveworkError::CampaignNotClosed);
        require!(
            ctx.accounts.node.conversions_count == 0,
            HiveworkError::NodeIsWinner
        );
        require!(
            ctx.accounts.node.stake_locked > 0,
            HiveworkError::NoStakeToForfeit
        );

        let stake = ctx.accounts.node.stake_locked;
        ctx.accounts.node.stake_locked = 0;

        **ctx.accounts.node.to_account_info().try_borrow_mut_lamports()? -= stake;
        **ctx
            .accounts
            .campaign
            .to_account_info()
            .try_borrow_mut_lamports()? += stake;

        ctx.accounts.campaign.forfeited_pool = ctx
            .accounts
            .campaign
            .forfeited_pool
            .checked_add(stake)
            .unwrap();

        Ok(())
    }

    /// Mueve el stake de un leaf perdedor al pool de la campaña.
    pub fn forfeit_leaf_stake(ctx: Context<ForfeitLeafStake>) -> Result<()> {
        require!(ctx.accounts.campaign.is_closed, HiveworkError::CampaignNotClosed);
        require!(
            ctx.accounts.leaf.conversions_count == 0,
            HiveworkError::NodeIsWinner
        );
        require!(
            ctx.accounts.leaf.stake_locked > 0,
            HiveworkError::NoStakeToForfeit
        );

        let stake = ctx.accounts.leaf.stake_locked;
        ctx.accounts.leaf.stake_locked = 0;

        **ctx.accounts.leaf.to_account_info().try_borrow_mut_lamports()? -= stake;
        **ctx
            .accounts
            .campaign
            .to_account_info()
            .try_borrow_mut_lamports()? += stake;

        ctx.accounts.campaign.forfeited_pool = ctx
            .accounts
            .campaign
            .forfeited_pool
            .checked_add(stake)
            .unwrap();

        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let amount = ctx.accounts.node.claimable_usdc;
        require!(amount > 0, HiveworkError::InsufficientFunds);

        ctx.accounts.node.claimable_usdc = 0;

        let stake_to_release = if ctx.accounts.node.conversions_count > 0
            && ctx.accounts.node.stake_locked > 0
        {
            let s = ctx.accounts.node.stake_locked;
            ctx.accounts.node.stake_locked = 0;
            s
        } else {
            0
        };

        let node_key = ctx.accounts.node.key();
        let campaign_key = ctx.accounts.campaign.key();
        let creator_key = ctx.accounts.creator.key();

        let auth_bytes = ctx.accounts.campaign.authority.to_bytes();
        let id_bytes = ctx.accounts.campaign.id.to_le_bytes();
        let bump = ctx.accounts.campaign.bump;
        let seeds: &[&[u8]] = &[
            CAMPAIGN_SEED,
            auth_bytes.as_ref(),
            id_bytes.as_ref(),
            std::slice::from_ref(&bump),
        ];
        let signer_seeds = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_usdc.to_account_info(),
            to: ctx.accounts.creator_usdc.to_account_info(),
            authority: ctx.accounts.campaign.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        if stake_to_release > 0 {
            **ctx.accounts.node.to_account_info().try_borrow_mut_lamports()? -= stake_to_release;
            **ctx
                .accounts
                .creator
                .to_account_info()
                .try_borrow_mut_lamports()? += stake_to_release;
        }

        emit!(PayoutClaimed {
            campaign: campaign_key,
            source: node_key,
            creator: creator_key,
            kind: PayoutKind::Node,
            amount_usdc: amount,
            stake_released_lamports: stake_to_release,
        });

        Ok(())
    }

    pub fn claim_leaf_payout(ctx: Context<ClaimLeafPayout>) -> Result<()> {
        let amount = ctx.accounts.leaf.claimable_usdc;
        require!(amount > 0, HiveworkError::InsufficientFunds);

        ctx.accounts.leaf.claimable_usdc = 0;

        let stake_to_release = if ctx.accounts.leaf.conversions_count > 0
            && ctx.accounts.leaf.stake_locked > 0
        {
            let s = ctx.accounts.leaf.stake_locked;
            ctx.accounts.leaf.stake_locked = 0;
            s
        } else {
            0
        };

        let leaf_key = ctx.accounts.leaf.key();
        let campaign_key = ctx.accounts.campaign.key();
        let creator_key = ctx.accounts.creator.key();

        let auth_bytes = ctx.accounts.campaign.authority.to_bytes();
        let id_bytes = ctx.accounts.campaign.id.to_le_bytes();
        let bump = ctx.accounts.campaign.bump;
        let seeds: &[&[u8]] = &[
            CAMPAIGN_SEED,
            auth_bytes.as_ref(),
            id_bytes.as_ref(),
            std::slice::from_ref(&bump),
        ];
        let signer_seeds = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_usdc.to_account_info(),
            to: ctx.accounts.creator_usdc.to_account_info(),
            authority: ctx.accounts.campaign.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        if stake_to_release > 0 {
            **ctx.accounts.leaf.to_account_info().try_borrow_mut_lamports()? -= stake_to_release;
            **ctx
                .accounts
                .creator
                .to_account_info()
                .try_borrow_mut_lamports()? += stake_to_release;
        }

        emit!(PayoutClaimed {
            campaign: campaign_key,
            source: leaf_key,
            creator: creator_key,
            kind: PayoutKind::Leaf,
            amount_usdc: amount,
            stake_released_lamports: stake_to_release,
        });

        Ok(())
    }

    /// Devuelve a la marca el USDC del escrow que no fue asignado a ningún ganador.
    /// Solo callable por la marca, después del cierre y de procesar todas las conversiones.
    pub fn withdraw_unused_usdc(ctx: Context<WithdrawUnusedUsdc>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        require!(campaign.is_closed, HiveworkError::CampaignNotClosed);
        require!(
            campaign.conversions_processed == campaign.total_conversions,
            HiveworkError::PendingConversions
        );
        require!(!campaign.unused_withdrawn, HiveworkError::UnusedAlreadyWithdrawn);

        let unused = campaign
            .total_usdc
            .saturating_sub(campaign.total_to_winners);
        require!(unused > 0, HiveworkError::NoUnusedUsdc);

        let auth_bytes = campaign.authority.to_bytes();
        let id_bytes = campaign.id.to_le_bytes();
        let bump = campaign.bump;
        let seeds: &[&[u8]] = &[
            CAMPAIGN_SEED,
            auth_bytes.as_ref(),
            id_bytes.as_ref(),
            std::slice::from_ref(&bump),
        ];
        let signer_seeds = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_usdc.to_account_info(),
            to: ctx.accounts.authority_usdc.to_account_info(),
            authority: ctx.accounts.campaign.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, unused)?;

        ctx.accounts.campaign.unused_withdrawn = true;
        Ok(())
    }

    /// Distribuye al creador del leaf una porción del pool forfeit, proporcional
    /// a sus conversiones sobre el total. Solo se puede reclamar una vez por leaf.
    /// Solo leaves ganadores (conversions_count > 0) son elegibles.
    pub fn claim_redistribution(ctx: Context<ClaimRedistribution>) -> Result<()> {
        require!(
            ctx.accounts.campaign.is_closed,
            HiveworkError::CampaignNotClosed
        );
        require!(
            ctx.accounts.leaf.conversions_count > 0,
            HiveworkError::NodeIsWinner
        );
        require!(
            !ctx.accounts.leaf.redistribution_claimed,
            HiveworkError::RedistributionAlreadyClaimed
        );
        require!(
            ctx.accounts.campaign.total_conversions > 0,
            HiveworkError::MathError
        );

        let pool = ctx.accounts.campaign.forfeited_pool;
        if pool == 0 {
            ctx.accounts.leaf.redistribution_claimed = true;
            return Ok(());
        }

        let share = (pool as u128) * (ctx.accounts.leaf.conversions_count as u128)
            / (ctx.accounts.campaign.total_conversions as u128);
        let share = share as u64;

        if share > 0 {
            // No bajar de rent-exempt para la cuenta campaign
            let campaign_ai = ctx.accounts.campaign.to_account_info();
            let rent = Rent::get()?;
            let min = rent.minimum_balance(campaign_ai.data_len());
            let available = campaign_ai
                .lamports()
                .saturating_sub(min);
            let payout = share.min(available).min(pool);

            **ctx.accounts.campaign.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx
                .accounts
                .creator
                .to_account_info()
                .try_borrow_mut_lamports()? += payout;

            ctx.accounts.campaign.forfeited_pool =
                ctx.accounts.campaign.forfeited_pool.saturating_sub(payout);
        }

        ctx.accounts.leaf.redistribution_claimed = true;
        Ok(())
    }
}

// ----------------------------------------------------------------------------
// Contexts
// ----------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(deadline: i64, alpha_weight: u8, beta_weight: u8, gamma_weight: u8, campaign_id: u32, initial_usdc: u64)]
pub struct CreateCampaign<'info> {
    #[account(
        init,
        payer = authority,
        space = Campaign::SPACE,
        seeds = [CAMPAIGN_SEED, authority.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign,
    )]
    pub escrow_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = authority,
    )]
    pub authority_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: pubkey del oracle autorizado, almacenada para validar conversiones
    pub oracle_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(level: u8, metadata_hash: [u8; 32], bytes_metadata: u32)]
pub struct CreateNode<'info> {
    #[account(
        init,
        payer = creator,
        space = Node::SPACE,
        seeds = [NODE_SEED, campaign.key().as_ref(), creator.key().as_ref(), metadata_hash.as_ref()],
        bump
    )]
    pub node: Account<'info, Node>,
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub parent_node: Option<Account<'info, Node>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ref_code: [u8; 8], bytes_metadata: u32)]
pub struct CreateLeaf<'info> {
    #[account(
        init,
        payer = creator,
        space = Leaf::SPACE,
        seeds = [LEAF_SEED, campaign.key().as_ref(), ref_code.as_ref()],
        bump
    )]
    pub leaf: Account<'info, Leaf>,
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub creator: Signer<'info>,

    pub node_l1: Account<'info, Node>,
    pub node_l2: Account<'info, Node>,
    pub node_l3: Account<'info, Node>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(conversion_id: [u8; 16], value: u64)]
pub struct RegisterConversion<'info> {
    #[account(
        init,
        payer = oracle,
        space = Conversion::SPACE,
        seeds = [CONVERSION_SEED, campaign.key().as_ref(), leaf.key().as_ref(), conversion_id.as_ref()],
        bump
    )]
    pub conversion: Account<'info, Conversion>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub leaf: Account<'info, Leaf>,
    #[account(mut)]
    pub node_l1: Account<'info, Node>,
    #[account(mut)]
    pub node_l2: Account<'info, Node>,
    #[account(mut)]
    pub node_l3: Account<'info, Node>,
    #[account(
        mut,
        address = campaign.oracle_authority @ HiveworkError::UnauthorizedOracle
    )]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    #[account(mut, has_one = authority)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseAndDistribute<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub conversion: Account<'info, Conversion>,
    #[account(mut)]
    pub leaf: Account<'info, Leaf>,
    #[account(mut)]
    pub node_l1: Account<'info, Node>,
    #[account(mut)]
    pub node_l2: Account<'info, Node>,
    #[account(mut)]
    pub node_l3: Account<'info, Node>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ForfeitNodeStake<'info> {
    #[account(mut, has_one = campaign)]
    pub node: Account<'info, Node>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ForfeitLeafStake<'info> {
    #[account(mut, has_one = campaign)]
    pub leaf: Account<'info, Leaf>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut, has_one = creator, has_one = campaign)]
    pub node: Account<'info, Node>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.authority.as_ref(), &campaign.id.to_le_bytes()],
        bump = campaign.bump,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, address = campaign.escrow_usdc)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = campaign.usdc_mint,
        token::authority = creator,
    )]
    pub creator_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimLeafPayout<'info> {
    #[account(mut, has_one = creator, has_one = campaign)]
    pub leaf: Account<'info, Leaf>,

    #[account(
        seeds = [CAMPAIGN_SEED, campaign.authority.as_ref(), &campaign.id.to_le_bytes()],
        bump = campaign.bump,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, address = campaign.escrow_usdc)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = campaign.usdc_mint,
        token::authority = creator,
    )]
    pub creator_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawUnusedUsdc<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [CAMPAIGN_SEED, campaign.authority.as_ref(), &campaign.id.to_le_bytes()],
        bump = campaign.bump,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, address = campaign.escrow_usdc)]
    pub escrow_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = campaign.usdc_mint,
        token::authority = authority,
    )]
    pub authority_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRedistribution<'info> {
    #[account(mut, has_one = creator, has_one = campaign)]
    pub leaf: Account<'info, Leaf>,

    #[account(mut)]
    pub campaign: Account<'info, Campaign>,

    #[account(mut)]
    pub creator: Signer<'info>,
}
