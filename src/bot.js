/**
 * T.I V1 - Main Bot Engine
 * 
 * COMPLETE TRADING FLOW:
 * START → ENTRY POINT → PURCHASE CONDITION → STAKE 1 → STAKE 2 → 
 * MARTINGALE → PLACE TRADE → MONITOR → WIN/LOSS → TAKE PROFIT/STOP LOSS → 
 * TRADE AGAIN → RESTART
 */

const fs = require('fs');
const path = require('path');
const StakeManager = require('./stakeManager');
const EntryPoint = require('./entryPoint');
const StrategyParser = require('./strategyParser');
const PaperExchange = require('./paperExchange');
const Logger = require('./logger');

class TIBotV1 {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('./logs/bot.log', 'INFO');
    
    // Core components
    this.stakeManager = new StakeManager(config.stakes);
    this.entryPoint = new EntryPoint(config.entry_point);
    this.paperExchange = new PaperExchange(config.initialBalance || 10000);
    
    // State
    this.isRunning = false;
    this.currentTrade = null;
    this.tradingCycle = 0;
    this.sessionStartTime = null;
  }

  /**
   * ========== BLOCK 1: START ==========
   * Initialize bot and load configuration
   */
  async start() {
    this.logger.info('=== BLOCK 1: START ===');
    this.logger.info('T.I V1 Bot Starting');
    
    try {
      // Load state if exists
      this.loadState();
      
      this.isRunning = true;
      this.sessionStartTime = new Date();
      this.tradingCycle++;
      
      this.logger.info('Bot initialized', {
        cycle: this.tradingCycle,
        initialBalance: this.paperExchange.getBalance(),
        config: this.config.name
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to start bot', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * ========== BLOCK 2: ENTRY POINT ==========
   * Analyze recent digit patterns and determine if trading is allowed
   */
  analyzeEntryPoint(digitHistory) {
    this.logger.info('=== BLOCK 2: ENTRY POINT ===');
    
    try {
      // Add digits to history
      digitHistory.forEach(digit => this.entryPoint.addDigit(digit));
      
      // Analyze entry conditions
      const analysis = this.entryPoint.analyze();
      
      this.logger.info('Entry Point Analysis', {
        entryAllowed: analysis.entryAllowed,
        reason: analysis.reason,
        digitCount: analysis.digitCount,
        frequency: analysis.details.frequency,
        minFrequency: analysis.details.minFrequency
      });
      
      return analysis;
    } catch (error) {
      this.logger.error('Entry Point Analysis Failed', { error: error.message });
      return { entryAllowed: false, reason: 'ANALYSIS_ERROR', details: {} };
    }
  }

  /**
   * ========== BLOCK 3: PURCHASE CONDITION ==========
   * Verify all requirements before placing a trade
   */
  checkPurchaseCondition(entryAnalysis) {
    this.logger.info('=== BLOCK 3: PURCHASE CONDITION ===');
    
    const conditions = {
      entryPointMet: entryAnalysis.entryAllowed,
      noActiveTrade: !this.currentTrade,
      balanceSufficient: false,
      contractValid: false,
      tpNotHit: false,
      slNotHit: false
    };

    // Check entry point
    if (!conditions.entryPointMet) {
      this.logger.warn('Purchase blocked: Entry point conditions not met', 
        { reason: entryAnalysis.reason });
      return { canPurchase: false, conditions };
    }

    // Check no active trade
    if (!conditions.noActiveTrade) {
      this.logger.warn('Purchase blocked: Active trade in progress');
      return { canPurchase: false, conditions };
    }
    conditions.noActiveTrade = true;

    // Get next stake
    const nextStake = this.stakeManager.getStakeForNextTrade();
    const balance = this.paperExchange.getBalance();
    
    // Check balance
    if (nextStake > balance) {
      this.logger.error('Purchase blocked: Insufficient balance', 
        { need: nextStake, have: balance });
      return { canPurchase: false, conditions };
    }
    conditions.balanceSufficient = true;

    // Check contract validity
    if (!this.config.market.symbol || !this.config.market.contract_type) {
      this.logger.error('Purchase blocked: Invalid contract parameters');
      return { canPurchase: false, conditions };
    }
    conditions.contractValid = true;

    // Check TP not hit
    const slCheck = this.stakeManager.canContinueTrading(
      this.config.risk_management.take_profit,
      this.config.risk_management.stop_loss
    );
    
    if (!slCheck.canTrade) {
      this.logger.warn('Purchase blocked: Trading limit reached', { reason: slCheck.reason });
      conditions.tpNotHit = slCheck.reason !== 'TAKE_PROFIT_HIT';
      conditions.slNotHit = slCheck.reason !== 'STOP_LOSS_HIT';
      return { canPurchase: false, conditions };
    }
    conditions.tpNotHit = true;
    conditions.slNotHit = true;

    // All conditions met
    this.logger.info('Purchase condition APPROVED', { stake: nextStake });
    return { canPurchase: true, conditions, stake: nextStake };
  }

  /**
   * ========== BLOCKS 4 & 5: STAKE 1 & STAKE 2 ==========
   * Determine correct stake for current trade
   */
  determineStake() {
    this.logger.info('=== BLOCKS 4 & 5: STAKE DETERMINATION ===');
    
    const stake = this.stakeManager.getStakeForNextTrade();
    const state = this.stakeManager.getState();
    
    if (!state.firstTradeUsed) {
      this.logger.info('BLOCK 4: Using STAKE 1 (First Trade)', { stake });
    } else {
      this.logger.info('BLOCKS 5+: Using STAKE 2 (Base Stake)', 
        { stake, martingaleLevel: state.martingaleLevel });
    }
    
    return stake;
  }

  /**
   * ========== BLOCK 6: MARTINGALE ==========
   * Calculate martingale progression if needed
   */
  applyMartingale(isLoss, previousResult = null) {
    this.logger.info('=== BLOCK 6: MARTINGALE ===');
    
    if (!isLoss) {
      this.logger.info('No martingale needed (Win or first trade)');
      return;
    }
    
    const stake = this.stakeManager.getCurrentStake();
    this.logger.info('Martingale applied after loss', { stake });
  }

  /**
   * ========== BLOCK 7 & 8: PLACE TRADE ==========
   * Execute the contract purchase
   */
  async placeTradeBlock(stake) {
    this.logger.info('=== BLOCK 7 & 8: PLACE TRADE ===');
    
    try {
      const contractParams = {
        stake: stake,
        contractType: this.config.market.contract_type,
        barrier: this.config.entry_point.barrier,
        symbol: this.config.market.symbol,
        duration: this.config.contract.duration,
        duration_unit: this.config.contract.duration_unit || 't'
      };

      // Simulate price for paper trading
      const simPrice = Math.random() * 10;
      this.paperExchange.setPrice(simPrice);

      // Place contract
      const result = this.paperExchange.buyContract(contractParams);
      
      this.currentTrade = {
        contractId: result.contractId,
        stake: stake,
        entryTime: new Date(),
        contractParams: contractParams,
        status: 'OPEN'
      };

      this.logger.info('Trade placed successfully', {
        contractId: result.contractId,
        stake: stake,
        type: contractParams.contractType,
        barrier: contractParams.barrier
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to place trade', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * ========== BLOCK 9: MONITOR & WIN/LOSS ==========
   * Wait for contract result and determine outcome
   */
  async monitorTradeBlock() {
    this.logger.info('=== BLOCK 9: MONITOR & WIN/LOSS ===');
    
    if (!this.currentTrade) {
      return { success: false, error: 'No active trade to monitor' };
    }

    try {
      // Simulate trade result
      // In real implementation, this would wait for actual contract result
      const resultDigit = Math.floor(Math.random() * 10);
      const isWin = this.evaluateTradeResult(resultDigit);
      const payout = isWin ? 90 : 0; // Example: 90% payout

      this.logger.info('Trade Result', {
        contractId: this.currentTrade.contractId,
        resultDigit: resultDigit,
        isWin: isWin,
        payout: payout
      });

      // Close contract in paper exchange
      const closeResult = this.paperExchange.closeContract(
        this.currentTrade.contractId,
        resultDigit,
        payout
      );

      // Record trade result
      const tradeRecord = this.stakeManager.recordTrade({
        isWin: isWin,
        payout: payout
      });

      // Update session profit/loss
      this.stakeManager.updateSessionProfitLoss(tradeRecord.profitLoss);

      this.logger.info('Trade recorded', {
        result: tradeRecord.message,
        profitLoss: tradeRecord.profitLoss,
        sessionPL: this.stakeManager.getSessionProfitLoss()
      });

      this.currentTrade.result = { isWin, resultDigit, profitLoss: tradeRecord.profitLoss };
      this.currentTrade.status = 'CLOSED';

      return {
        success: true,
        tradeResult: tradeRecord,
        balanceAfterTrade: this.paperExchange.getBalance()
      };
    } catch (error) {
      this.logger.error('Trade monitoring failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Evaluate if trade result meets Over/Under condition
   */
  evaluateTradeResult(resultDigit) {
    const barrier = this.config.entry_point.barrier;
    const contractType = this.config.market.contract_type;

    if (contractType === 'DIGITOVER') {
      return resultDigit > barrier;
    } else if (contractType === 'DIGITUNDER') {
      return resultDigit < barrier;
    }
    return false;
  }

  /**
   * ========== BLOCK 10: TAKE PROFIT / STOP LOSS ==========
   * Check if trading limits have been reached
   */
  checkTradingLimits() {
    this.logger.info('=== BLOCK 10: TAKE PROFIT / STOP LOSS ===');
    
    const slCheck = this.stakeManager.canContinueTrading(
      this.config.risk_management.take_profit,
      this.config.risk_management.stop_loss
    );

    const sessionPL = this.stakeManager.getSessionProfitLoss();
    const tp = this.config.risk_management.take_profit;
    const sl = this.config.risk_management.stop_loss;

    this.logger.info('Trading Limits Check', {
      sessionProfitLoss: sessionPL,
      takeProfit: tp,
      stopLoss: sl,
      canContinue: slCheck.canTrade,
      reason: slCheck.reason
    });

    return slCheck;
  }

  /**
   * ========== BLOCK 11: TRADE AGAIN ==========
   * Loop back to entry point if conditions allow
   */
  async tradeAgainBlock() {
    this.logger.info('=== BLOCK 11: TRADE AGAIN ===');
    
    const slCheck = this.checkTradingLimits();
    
    if (!slCheck.canTrade) {
      this.logger.info('Trading halted', { reason: slCheck.reason });
      return { continueTrading: false, reason: slCheck.reason };
    }

    this.logger.info('Preparing for next trade');
    return { continueTrading: true };
  }

  /**
   * ========== BLOCK 12: RESTART ==========
   * Reset state for new trading cycle
   */
  restartCycle() {
    this.logger.info('=== BLOCK 12: RESTART ===');
    this.logger.info('Resetting for new trading cycle');
    
    this.stakeManager.reset();
    this.entryPoint.reset();
    this.currentTrade = null;
    this.tradingCycle++;
    this.sessionStartTime = new Date();
    
    this.logger.info('Restart complete', { newCycle: this.tradingCycle });
  }

  /**
   * ========== MAIN TRADING LOOP ==========
   * Complete trading sequence
   */
  async runTradingCycle(digitHistory) {
    this.logger.info('\n' + '='.repeat(60));
    this.logger.info(`TRADING CYCLE ${this.tradingCycle}`);
    this.logger.info('='.repeat(60));

    try {
      // BLOCK 2: Entry Point
      const entryAnalysis = this.analyzeEntryPoint(digitHistory);
      if (!entryAnalysis.entryAllowed) {
        this.logger.info('Entry conditions not met. Waiting for next opportunity.');
        return { cycleComplete: false, reason: 'ENTRY_CONDITIONS_NOT_MET' };
      }

      // BLOCK 3: Purchase Condition
      const purchaseCheck = this.checkPurchaseCondition(entryAnalysis);
      if (!purchaseCheck.canPurchase) {
        this.logger.info('Cannot purchase at this time');
        return { cycleComplete: false, reason: 'PURCHASE_CONDITION_FAILED', conditions: purchaseCheck.conditions };
      }

      // BLOCKS 4 & 5: Determine Stake
      const stake = this.determineStake();

      // BLOCK 6: Martingale (if applicable)
      if (this.currentTrade?.result?.isWin === false) {
        this.applyMartingale(true);
      }

      // BLOCKS 7 & 8: Place Trade
      const tradeResult = await this.placeTradeBlock(stake);
      if (!tradeResult.success && tradeResult.error) {
        this.logger.error('Trade placement failed');
        return { cycleComplete: false, reason: 'TRADE_PLACEMENT_FAILED' };
      }

      // BLOCK 9: Monitor & Win/Loss
      const monitorResult = await this.monitorTradeBlock();
      if (!monitorResult.success) {
        this.logger.error('Trade monitoring failed');
        return { cycleComplete: false, reason: 'TRADE_MONITORING_FAILED' };
      }

      // BLOCK 10: Take Profit / Stop Loss
      const limitCheck = this.checkTradingLimits();

      if (!limitCheck.canTrade) {
        this.logger.info('Trading limits reached');
        return { cycleComplete: true, reason: limitCheck.reason };
      }

      // BLOCK 11: Trade Again
      const tradeAgain = await this.tradeAgainBlock();

      if (!tradeAgain.continueTrading) {
        this.logger.info('Trading cycle ended', { reason: tradeAgain.reason });
        return { cycleComplete: true, reason: tradeAgain.reason };
      }

      this.logger.info('Cycle complete, ready for next trade');
      return { cycleComplete: true, reason: 'NORMAL_COMPLETION' };
    } catch (error) {
      this.logger.error('Trading cycle error', { error: error.message });
      return { cycleComplete: false, error: error.message };
    }
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      running: this.isRunning,
      cycle: this.tradingCycle,
      sessionStartTime: this.sessionStartTime,
      currentTrade: this.currentTrade,
      stakeState: this.stakeManager.getState(),
      balance: this.paperExchange.getBalance(),
      trades: this.paperExchange.getTradeHistory().length,
      sessionProfitLoss: this.stakeManager.getSessionProfitLoss()
    };
  }

  /**
   * Save state for recovery
   */
  saveState() {
    const state = {
      timestamp: new Date().toISOString(),
      cycle: this.tradingCycle,
      stakeManager: this.stakeManager.getState(),
      entryPoint: this.entryPoint.getState(),
      balance: this.paperExchange.getBalance(),
      trades: this.paperExchange.getTradeHistory()
    };
    
    const stateFile = this.config.state_file || './state/bot-state.json';
    const dir = path.dirname(stateFile);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    this.logger.info('State saved', { file: stateFile });
  }

  /**
   * Load state for recovery
   */
  loadState() {
    const stateFile = this.config.state_file || './state/bot-state.json';
    
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      this.stakeManager.restoreState(state.stakeManager);
      this.tradingCycle = state.cycle;
      this.logger.info('State restored', { file: stateFile });
    }
  }

  /**
   * Stop bot
   */
  async stop() {
    this.logger.info('Bot stopping...');
    this.isRunning = false;
    this.saveState();
    this.logger.info('Bot stopped');
  }
}

module.exports = TIBotV1;
