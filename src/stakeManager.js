/**
 * Stake Manager - Handles all stake calculations and martingale logic
 * 
 * CRITICAL STAKE RULES:
 * 1. Stake 1 is used ONLY for the first trade
 * 2. After first trade, Stake 2 becomes the permanent base
 * 3. On loss: current_stake = current_stake * martingale_multiplier
 * 4. On win: current_stake = Stake 2 (NOT back to Stake 1)
 */

class StakeManager {
  constructor(config) {
    this.stake1 = parseFloat(config.stake1);
    this.stake2 = parseFloat(config.stake2);
    this.martingaleMultiplier = parseFloat(config.martingale_multiplier);
    this.maxMartingaleSteps = parseInt(config.max_martingale_steps);
    
    // State tracking
    this.firstTradeUsed = false;
    this.currentStake = this.stake1;
    this.martingaleLevel = 0;
    this.sessionProfitLoss = 0;
    this.tradeCount = 0;
  }

  /**
   * Get current stake for the next trade
   * RULE: Stake 1 only on first trade, then Stake 2 becomes base
   */
  getCurrentStake() {
    return this.currentStake;
  }

  /**
   * Called BEFORE placing a trade
   * Returns the stake that SHOULD be used for this trade
   */
  getStakeForNextTrade() {
    if (!this.firstTradeUsed) {
      // First trade: use Stake 1
      return this.stake1;
    } else {
      // After first trade: use Stake 2 or martingale variant
      return this.stake2 * Math.pow(this.martingaleMultiplier, this.martingaleLevel);
    }
  }

  /**
   * Called AFTER a trade is executed
   * Updates internal state and stake for next iteration
   */
  recordTrade(tradeResult) {
    this.tradeCount++;
    const stake = this.currentStake;
    let profitLoss = 0;

    if (tradeResult.isWin) {
      // WIN: calculate profit and reset martingale
      profitLoss = (stake * (tradeResult.payout / 100)) - stake;
      this.martingaleLevel = 0;
      
      // After first trade, Stake 2 becomes permanent base
      if (this.firstTradeUsed) {
        this.currentStake = this.stake2;
      } else {
        // First trade won - switch to Stake 2 for future trades
        this.firstTradeUsed = true;
        this.currentStake = this.stake2;
      }
      
      return {
        isWin: true,
        profitLoss: profitLoss,
        nextStake: this.currentStake,
        martingaleLevel: this.martingaleLevel,
        message: `WIN with stake ${stake}. Profit: ${profitLoss}. Next stake: ${this.currentStake}`
      };
    } else {
      // LOSS: calculate loss and apply martingale
      profitLoss = -stake;
      
      // Mark first trade as used if this is first trade
      if (!this.firstTradeUsed) {
        this.firstTradeUsed = true;
      }
      
      // Check if we've hit max martingale steps
      if (this.martingaleLevel >= this.maxMartingaleSteps) {
        this.martingaleLevel = 0;
        this.currentStake = this.stake2;
        return {
          isWin: false,
          profitLoss: profitLoss,
          nextStake: this.currentStake,
          martingaleLevel: this.martingaleLevel,
          message: `LOSS with stake ${stake}. Hit max martingale steps. Resetting to Stake 2: ${this.currentStake}`
        };
      }
      
      // Apply martingale: increase stake for recovery
      this.martingaleLevel++;
      this.currentStake = this.stake2 * Math.pow(this.martingaleMultiplier, this.martingaleLevel);
      
      return {
        isWin: false,
        profitLoss: profitLoss,
        nextStake: this.currentStake,
        martingaleLevel: this.martingaleLevel,
        message: `LOSS with stake ${stake}. Applying martingale. Next stake: ${this.currentStake}`
      };
    }
  }

  /**
   * Update session profit/loss
   */
  updateSessionProfitLoss(profitLoss) {
    this.sessionProfitLoss += profitLoss;
    return this.sessionProfitLoss;
  }

  /**
   * Get current session profit/loss
   */
  getSessionProfitLoss() {
    return this.sessionProfitLoss;
  }

  /**
   * Check if we can continue trading
   */
  canContinueTrading(takeProfitLimit, stopLossLimit) {
    if (takeProfitLimit && this.sessionProfitLoss >= takeProfitLimit) {
      return { canTrade: false, reason: `TAKE_PROFIT_HIT: ${this.sessionProfitLoss} >= ${takeProfitLimit}` };
    }
    if (stopLossLimit && this.sessionProfitLoss <= -stopLossLimit) {
      return { canTrade: false, reason: `STOP_LOSS_HIT: ${-this.sessionProfitLoss} >= ${stopLossLimit}` };
    }
    return { canTrade: true, reason: 'OK' };
  }

  /**
   * Reset for new trading cycle
   */
  reset() {
    this.firstTradeUsed = false;
    this.currentStake = this.stake1;
    this.martingaleLevel = 0;
    this.sessionProfitLoss = 0;
    this.tradeCount = 0;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      firstTradeUsed: this.firstTradeUsed,
      currentStake: this.currentStake,
      martingaleLevel: this.martingaleLevel,
      sessionProfitLoss: this.sessionProfitLoss,
      tradeCount: this.tradeCount
    };
  }

  /**
   * Restore state
   */
  restoreState(state) {
    this.firstTradeUsed = state.firstTradeUsed;
    this.currentStake = state.currentStake;
    this.martingaleLevel = state.martingaleLevel;
    this.sessionProfitLoss = state.sessionProfitLoss;
    this.tradeCount = state.tradeCount;
  }
}

module.exports = StakeManager;
