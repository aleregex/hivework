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
    ) -> Result<()> {
        // Validaciones
        require!(
            (alpha_weight as u16) + (beta_weight as u16) + (gamma_weight as u16) == 100,
            HiveworkError::InvalidWeights
        );
        let clock = Clock::get()?;
        require!(deadline > clock.unix_timestamp, HiveworkError::InvalidDeadline);
        require!(initial_usdc > 0, HiveworkError::InsufficientFunds);

        // Transferir USDC de la marca → escrow PDA
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
        campaign.bump = ctx.bumps.campaign;

        emit!(CampaignCreated {
            campaign: campaign.key(),
            authority: campaign.authority,
            total_usdc: campaign.total_usdc,
            deadline: campaign.deadline,
        });

        Ok(())
    }

    pub fn create_node(
        ctx: Context<CreateNode>,
        level: u8,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.campaign.is_closed, HiveworkError::CampaignClosed);
        require!((1..=3).contains(&level), HiveworkError::InvalidLevel);

        let required_stake = match level {
            1 => L1_STAKE_AMOUNT,
            2 => L2_STAKE_AMOUNT,
            3 => L3_STAKE_AMOUNT,
            _ => return err!(HiveworkError::InvalidLevel),
        };

        let node = &mut ctx.accounts.node;

        // Stake en SOL: lamports del creador → PDA del nodo
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
        });

        Ok(())
    }

    pub fn create_leaf(ctx: Context<CreateLeaf>, ref_code: [u8; 8]) -> Result<()> {
        require!(!ctx.accounts.campaign.is_closed, HiveworkError::CampaignClosed);

        // Validar path genealógico antes de mutar nada
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
        // Todos los nodos del path pertenecen a la misma campaña
        let campaign_key = ctx.accounts.campaign.key();
        require!(
            ctx.accounts.node_l1.campaign == campaign_key
                && ctx.accounts.node_l2.campaign == campaign_key
                && ctx.accounts.node_l3.campaign == campaign_key,
            HiveworkError::InvalidGenealogicalPath
        );

        let leaf = &mut ctx.accounts.leaf;

        // Stake en SOL para la hoja
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
        leaf.stake_locked = LEAF_STAKE_AMOUNT;
        leaf.conversions_count = 0;
        leaf.claimable_usdc = 0;
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
        });

        Ok(())
    }

    pub fn register_conversion(
        ctx: Context<RegisterConversion>,
        conversion_id: [u8; 16],
        value: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.campaign.is_closed, HiveworkError::CampaignClosed);
        // Path coherente
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

        // Update counters
        ctx.accounts.leaf.conversions_count =
            ctx.accounts.leaf.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l3.conversions_count =
            ctx.accounts.node_l3.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l2.conversions_count =
            ctx.accounts.node_l2.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l1.conversions_count =
            ctx.accounts.node_l1.conversions_count.checked_add(1).unwrap();

        emit!(ConversionRegistered {
            conversion: conversion.key(),
            campaign: conversion.campaign,
            leaf: conversion.leaf,
            value: conversion.value,
        });

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

        // Procesar una conversión por llamada (idempotente, batch)
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

        // Pesos escalados (×10) para evitar floats
        let alpha_sc = (campaign.alpha_weight as u64) * 10;
        let beta_sc = (campaign.beta_weight as u64) * 10;
        let gamma_sc = (campaign.gamma_weight as u64) * 10;

        let calc = |forks: u32, level_pos: u8| -> u64 {
            // log(forks+1) aproximado por forks*10 (MVP — nota documentada en README)
            let log_approx = (forks as u64) * 10;
            let richness = 500u64; // bytes_metadata no se almacena; constante 0.5 (MVP)
            let w1 = (alpha_sc * log_approx) / 1000;
            let w2 = (beta_sc * richness) / 1000;
            let w3 = (gamma_sc * (level_pos as u64)) / 1000;
            w1 + w2 + w3
        };

        let w_l1 = calc(ctx.accounts.node_l1.forks_count, POS_FACTOR_L1);
        let w_l2 = calc(ctx.accounts.node_l2.forks_count, POS_FACTOR_L2);
        let w_l3 = calc(ctx.accounts.node_l3.forks_count, POS_FACTOR_L3);
        let w_leaf = calc(0, POS_FACTOR_LEAF);

        let total_weight = w_l1 + w_l2 + w_l3 + w_leaf;
        require!(total_weight > 0, HiveworkError::MathError);

        let fee = (conversion.value * (campaign.platform_fee as u64)) / 100;
        let distributable = conversion.value - fee;

        let leaf_bonus = (distributable * (LEAF_BONUS_PERCENTAGE as u64)) / 100;
        let shared_pool = distributable - leaf_bonus;

        ctx.accounts.node_l1.claimable_usdc = ctx
            .accounts
            .node_l1
            .claimable_usdc
            .saturating_add((shared_pool * w_l1) / total_weight);
        ctx.accounts.node_l2.claimable_usdc = ctx
            .accounts
            .node_l2
            .claimable_usdc
            .saturating_add((shared_pool * w_l2) / total_weight);
        ctx.accounts.node_l3.claimable_usdc = ctx
            .accounts
            .node_l3
            .claimable_usdc
            .saturating_add((shared_pool * w_l3) / total_weight);

        ctx.accounts.leaf.claimable_usdc = ctx
            .accounts
            .leaf
            .claimable_usdc
            .saturating_add(((shared_pool * w_leaf) / total_weight) + leaf_bonus);

        conversion.is_processed = true;
        campaign.conversions_processed = campaign.conversions_processed.checked_add(1).unwrap();

        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let amount = ctx.accounts.node.claimable_usdc;
        require!(amount > 0, HiveworkError::InsufficientFunds);

        // CEI: state primero
        ctx.accounts.node.claimable_usdc = 0;

        // Liberar stake en lamports si el nodo aportó conversiones
        let stake_to_release = if ctx.accounts.node.conversions_count > 0
            && ctx.accounts.node.stake_locked > 0
        {
            let s = ctx.accounts.node.stake_locked;
            ctx.accounts.node.stake_locked = 0;
            s
        } else {
            0
        };

        // SPL transfer firmado por la PDA de la campaña
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

    /// CHECK: pubkey del oracle autorizado, se almacena para validar conversiones
    pub oracle_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(level: u8, metadata_hash: [u8; 32])]
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
#[instruction(ref_code: [u8; 8])]
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

    // Path genealógico explícito (validación en handler)
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
    pub authority: Signer<'info>, // cualquiera puede empujar el batch
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
