/**
 * Main Entry Point - T.I V1 Bot
 */

const path = require('path');
const TIBotV1 = require('./bot');
const StrategyParser = require('./strategyParser');
const Logger = require('./logger');

class BotRunner {
  constructor() {
    this.logger = new Logger('./logs/bot.log', 'INFO');
    this.bot = null;
  }

  /**
   * Initialize and run bot
   */
  async run(configFile) {
    this.logger.info('\n' + '='.repeat(70));
    this.logger.info('T.I V1 - DERIV MARTINGALE BOT');
    this.logger.info('='.repeat(70));

    try {
      // Parse strategy XML
      this.logger.info('Loading strategy configuration...', { file: configFile });
      const parser = new StrategyParser();
      const config = await parser.parseFile(configFile);

      // Validate configuration
      const validation = parser.validateConfig(config);
      if (!validation.valid) {
        this.logger.error('Invalid configuration', { errors: validation.errors });
        return;
      }

      this.logger.info('Configuration loaded and validated', { strategy: config.name });

      // Create bot instance
      this.bot = new TIBotV1(config);

      // Start bot
      const startResult = await this.bot.start();
      if (!startResult.success) {
        this.logger.error('Failed to start bot', { error: startResult.error });
        return;
      }

      // Example: Run trading cycle with simulated digit history
      this.logger.info('Bot ready. Running trading cycles...');
      
      // Simulate digit history for testing
      const digitHistories = [
        [7, 2, 8, 5, 9, 1, 6, 4, 8, 3], // First entry
        [6, 3, 7, 8, 9, 2, 1, 4, 5, 8],  // Second entry
        [8, 7, 9, 6, 5, 4, 3, 2, 1, 0]   // Third entry
      ];

      for (let i = 0; i < digitHistories.length; i++) {
        const digitHistory = digitHistories[i];
        
        const result = await this.bot.runTradingCycle(digitHistory);
        
        this.logger.info(`\nCycle result:`, result);
        this.logger.info('Bot status:', this.bot.getStatus());

        if (result.reason === 'TAKE_PROFIT_HIT' || result.reason === 'STOP_LOSS_HIT') {
          this.logger.info('Trading limit reached. Restarting...');
          this.bot.restartCycle();
        }

        // Wait between cycles
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Final report
      this.printReport();

      // Save state
      this.bot.saveState();
      await this.bot.stop();
    } catch (error) {
      this.logger.error('Fatal error', { error: error.message, stack: error.stack });
    }
  }

  /**
   * Print trading report
   */
  printReport() {
    this.logger.info('\n' + '='.repeat(70));
    this.logger.info('TRADING SESSION REPORT');
    this.logger.info('='.repeat(70));

    const status = this.bot.getStatus();
    const trades = this.bot.paperExchange.getTradeHistory();

    this.logger.info('SESSION SUMMARY', {
      cycle: status.cycle,
      totalTrades: trades.length,
      finalBalance: status.balance,
      sessionProfitLoss: status.sessionProfitLoss,
      startTime: status.sessionStartTime
    });

    if (trades.length > 0) {
      this.logger.info('\nTRADE HISTORY');
      trades.forEach((trade, i) => {
        this.logger.info(`Trade ${i + 1}`, {
          stake: trade.stake,
          result: trade.result,
          profit: trade.profit,
          type: trade.contractType
        });
      });
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isPaper = args.includes('--paper') || !args.includes('--live');
const configFile = args.find(arg => !arg.startsWith('--')) || './config/strategy.xml';

// Run bot
const runner = new BotRunner();
runner.run(configFile).catch(error => {
  console.error('Failed to run bot:', error);
  process.exit(1);
});

module.exports = BotRunner;
