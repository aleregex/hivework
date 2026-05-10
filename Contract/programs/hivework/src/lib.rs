use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod state;

use constants::*;
use errors::*;
use events::*;
use state::*;

declare_id!("8qT4Yoj9ZYdvFUZm7Pz3YBTA8idQ5VgbZ4Cdcypfw3Ue");

#[program]
pub mod hivework {
    use super::*;

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        deadline: i64,
        alpha_weight: u8,
        beta_weight: u8,
        gamma_weight: u8,
        _campaign_id: u32,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        campaign.authority = ctx.accounts.authority.key();
        campaign.escrow_usdc = ctx.accounts.escrow_usdc.key();
        campaign.total_usdc = 0; // Deposit is handled via SPL Token transfer usually, or off-chain tracked, but for simplicity let's track it later
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
        let node = &mut ctx.accounts.node;
        require!(level >= 1 && level <= 3, HiveworkError::InvalidLevel);
        
        let required_stake = match level {
            1 => L1_STAKE_AMOUNT,
            2 => L2_STAKE_AMOUNT,
            3 => L3_STAKE_AMOUNT,
            _ => return err!(HiveworkError::InvalidLevel),
        };

        // En MVP, transferimos lamports del creador a la PDA del nodo
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
            let parent_info = ctx.accounts.parent_node.as_ref().unwrap();
            // Need to deserialize parent to check level
            let parent_data = parent_info.try_borrow_data()?;
            let parent_level = parent_data[8 + 32 + 32 + 33]; // Offset to level byte
            require!(parent_level == level - 1, HiveworkError::InvalidParentNode);
            node.parent_node = Some(parent_info.key());
            
            // For MVP, we don't dynamically update all ancestors forks_count directly here to save compute,
            // or we could do it since it's only 2 max parents.
        }

        emit!(NodeCreated {
            node: node.key(),
            campaign: node.campaign,
            creator: node.creator,
            level: node.level,
        });

        Ok(())
    }

    pub fn create_leaf(
        ctx: Context<CreateLeaf>,
        ref_code: [u8; 8],
    ) -> Result<()> {
        let leaf = &mut ctx.accounts.leaf;
        
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: leaf.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, LEAF_STAKE_AMOUNT)?;

        leaf.campaign = ctx.accounts.campaign.key();
        leaf.creator = ctx.accounts.creator.key();
        leaf.parent_node = ctx.accounts.parent_node.key();
        leaf.ref_code = ref_code;
        leaf.stake_locked = LEAF_STAKE_AMOUNT;
        leaf.conversions_count = 0;
        leaf.claimable_usdc = 0;
        leaf.bump = ctx.bumps.leaf;

        // Verify the genealogical path exactly matches the chain
        require!(ctx.accounts.node_l3.level == 3, HiveworkError::InvalidGenealogicalPath);
        require!(ctx.accounts.node_l2.level == 2, HiveworkError::InvalidGenealogicalPath);
        require!(ctx.accounts.node_l1.level == 1, HiveworkError::InvalidGenealogicalPath);
        
        require!(ctx.accounts.node_l3.parent_node == Some(ctx.accounts.node_l2.key()), HiveworkError::InvalidGenealogicalPath);
        require!(ctx.accounts.node_l2.parent_node == Some(ctx.accounts.node_l1.key()), HiveworkError::InvalidGenealogicalPath);

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
        let conversion = &mut ctx.accounts.conversion;
        // The oracle is verified via Signer constraint in Context
        // For MVP, we can hardcode an Oracle or check against a config.
        // Let's assume anyone who holds the oracle keypair can sign.
        
        conversion.campaign = ctx.accounts.campaign.key();
        conversion.leaf = ctx.accounts.leaf.key();
        conversion.oracle = ctx.accounts.oracle.key();
        conversion.id = conversion_id;
        conversion.value = value;
        conversion.is_processed = false;
        conversion.bump = ctx.bumps.conversion;

        // Update counters
        ctx.accounts.leaf.conversions_count = ctx.accounts.leaf.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l3.conversions_count = ctx.accounts.node_l3.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l2.conversions_count = ctx.accounts.node_l2.conversions_count.checked_add(1).unwrap();
        ctx.accounts.node_l1.conversions_count = ctx.accounts.node_l1.conversions_count.checked_add(1).unwrap();

        emit!(ConversionRegistered {
            conversion: conversion.key(),
            campaign: conversion.campaign,
            leaf: conversion.leaf,
            value: conversion.value,
        });

        Ok(())
    }

    pub fn close_and_distribute(
        ctx: Context<CloseAndDistribute>,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= campaign.deadline || campaign.is_closed, HiveworkError::CampaignNotClosed);
        
        if !campaign.is_closed {
            campaign.is_closed = true;
            emit!(CampaignClosed {
                campaign: campaign.key(),
                conversions_processed: campaign.conversions_processed,
            });
        }

        // Logic for batch processing
        // We calculate the weights and update the `claimable_usdc` of each node in the path.
        // For each conversion provided in remaining accounts (or a specific conversion account passed):
        let conversion = &mut ctx.accounts.conversion;
        require!(!conversion.is_processed, HiveworkError::ConversionAlreadyRegistered);
        
        let _alpha = campaign.alpha_weight as f64 / 100.0;
        let _beta = campaign.beta_weight as f64 / 100.0;
        let _gamma = campaign.gamma_weight as f64 / 100.0;

        // Weights
        // To avoid floating point in Anchor, we'll do scaled integer math (x 1000)
        let alpha_sc = (campaign.alpha_weight as u64) * 10;
        let beta_sc = (campaign.beta_weight as u64) * 10;
        let gamma_sc = (campaign.gamma_weight as u64) * 10;

        let calculate_weight = |forks: u32, level_pos: u8| -> u64 {
            // log(forks + 1) approximation: we can just use forks directly or a simple lookup for MVP
            let log_approx = (forks as u64) * 10; // Simplified for MVP
            let richness = 500; // Simplified for MVP

            let w1 = (alpha_sc * log_approx) / 1000;
            let w2 = (beta_sc * richness) / 1000;
            let w3 = (gamma_sc * (level_pos as u64)) / 1000;
            w1 + w2 + w3
        };

        let w_l1 = calculate_weight(ctx.accounts.node_l1.forks_count, POS_FACTOR_L1);
        let w_l2 = calculate_weight(ctx.accounts.node_l2.forks_count, POS_FACTOR_L2);
        let w_l3 = calculate_weight(ctx.accounts.node_l3.forks_count, POS_FACTOR_L3);
        let w_leaf = calculate_weight(0, POS_FACTOR_LEAF); // leaf has no forks

        let total_weight = w_l1 + w_l2 + w_l3 + w_leaf;
        require!(total_weight > 0, HiveworkError::MathError);

        let fee = (conversion.value * (campaign.platform_fee as u64)) / 100;
        let distributable = conversion.value - fee;

        let leaf_bonus = (distributable * (LEAF_BONUS_PERCENTAGE as u64)) / 100;
        let shared_pool = distributable - leaf_bonus;

        ctx.accounts.node_l1.claimable_usdc += (shared_pool * w_l1) / total_weight;
        ctx.accounts.node_l2.claimable_usdc += (shared_pool * w_l2) / total_weight;
        ctx.accounts.node_l3.claimable_usdc += (shared_pool * w_l3) / total_weight;
        
        ctx.accounts.leaf.claimable_usdc += ((shared_pool * w_leaf) / total_weight) + leaf_bonus;

        conversion.is_processed = true;
        campaign.conversions_processed += 1;

        Ok(())
    }

    pub fn claim_payout(
        ctx: Context<ClaimPayout>,
    ) -> Result<()> {
        let node = &mut ctx.accounts.node;
        let amount = node.claimable_usdc;
        require!(amount > 0, HiveworkError::InsufficientFunds);

        // Checks-Effects-Interactions
        node.claimable_usdc = 0;

        // Perform CPI transfer of USDC from Campaign Escrow to User
        // Note: For MVP, assume token program CPI here
        
        // Also release stake in SOL if conversions > 0
        if node.conversions_count > 0 && node.stake_locked > 0 {
            let stake = node.stake_locked;
            node.stake_locked = 0;
            // Subtract lamports from PDA and add to creator
            **node.to_account_info().try_borrow_mut_lamports()? -= stake;
            **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += stake;
        }

        Ok(())
    }
}

// ----------------------------------------------------------------------------
// Contexts
// ----------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(deadline: i64, alpha_weight: u8, beta_weight: u8, gamma_weight: u8, campaign_id: u32)]
pub struct CreateCampaign<'info> {
    #[account(
        init,
        payer = authority,
        space = Campaign::SPACE,
        seeds = [CAMPAIGN_SEED, authority.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: The USDC token account acting as escrow
    pub escrow_usdc: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
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
    /// CHECK: Validated dynamically
    pub parent_node: Option<UncheckedAccount<'info>>,
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
    #[account(mut)]
    pub parent_node: Account<'info, Node>, // L3
    
    // Explicit genealogical path for validation
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
    #[account(mut)]
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
    pub authority: Signer<'info>, // anyone can call this actually
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub node: Account<'info, Node>, // Can be Node or Leaf, for simplicity just Node struct here
    #[account(mut)]
    pub creator: Signer<'info>,
    // SPL token accounts would go here
}
