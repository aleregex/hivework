use anchor_lang::prelude::*;

#[error_code]
pub enum HiveworkError {
    #[msg("Campaña ya ha cerrado")]
    CampaignClosed,
    #[msg("Campaña aún no ha cerrado")]
    CampaignNotClosed,
    #[msg("Firma de oracle inválida o no autorizada")]
    UnauthorizedOracle,
    #[msg("El nivel del nodo debe ser 1, 2 o 3")]
    InvalidLevel,
    #[msg("Nodo padre inválido para el nivel especificado")]
    InvalidParentNode,
    #[msg("El path genealógico de la hoja es incorrecto")]
    InvalidGenealogicalPath,
    #[msg("Stake insuficiente provisto")]
    InsufficientStake,
    #[msg("No hay suficientes fondos para retirar")]
    InsufficientFunds,
    #[msg("Matemática falló en cálculo de payout")]
    MathError,
    #[msg("Idempotencia: La conversión ya fue registrada")]
    ConversionAlreadyRegistered,
    #[msg("Excede máxima longitud de bytes")]
    DataTooLarge,
    #[msg("Los pesos alpha + beta + gamma deben sumar 100")]
    InvalidWeights,
    #[msg("La deadline debe ser una fecha futura")]
    InvalidDeadline,
}
