/**
 * Paper Exchange Simulator
 * Simulates trading without real money for testing
 */

class PaperExchange {
  constructor(initialBalance = 10000) {
    this.balance = initialBalance;
    this.positions = {}; // { contractId: { stake, entry_price, type, status } }
    this.trades = [];
    this.contractCounter = 0;
    this.currentPrice = null;
  }

  /**
   * Set current price for simulation
   */
  setPrice(price) {
    this.currentPrice = price;
  }

  /**
   * Simulate getting current ticker
   */
  getPrice() {
    return this.currentPrice;
  }

  /**
   * Buy a contract (simulated)
   */
  buyContract(contractParams) {
    const { stake, contractType, barrier, duration } = contractParams;

    // Check balance
    if (stake > this.balance) {
      throw new Error(`Insufficient balance: need ${stake}, have ${this.balance}`);
    }

    // Deduct stake from balance
    this.balance -= stake;

    // Create contract
    const contractId = ++this.contractCounter;
    const contract = {
      id: contractId,
      stake: stake,
      contractType: contractType,
      barrier: barrier,
      duration: duration,
      entryPrice: this.currentPrice,
      entryTime: new Date(),
      status: 'OPEN',
      exitPrice: null,
      exitTime: null,
      result: null
    };

    this.positions[contractId] = contract;

    return {
      success: true,
      contractId: contractId,
      stake: stake,
      entryPrice: this.currentPrice,
      balance: this.balance
    };
  }

  /**
   * Close contract with result
   */
  closeContract(contractId, resultDigit, payout) {
    const contract = this.positions[contractId];
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    const isWin = payout > 0;
    const profit = isWin ? contract.stake * (payout / 100) : -contract.stake;

    contract.exitPrice = resultDigit;
    contract.exitTime = new Date();
    contract.status = 'CLOSED';
    contract.result = isWin ? 'WIN' : 'LOSS';
    contract.payout = payout;
    contract.profit = profit;

    // Add profit/loss to balance
    this.balance += contract.stake + profit;

    // Record trade
    this.trades.push(contract);

    return {
      success: true,
      contractId: contractId,
      result: contract.result,
      profit: profit,
      newBalance: this.balance
    };
  }

  /**
   * Get balance
   */
  getBalance() {
    return this.balance;
  }

  /**
   * Get trade history
   */
  getTradeHistory() {
    return this.trades;
  }

  /**
   * Get open positions
   */
  getOpenPositions() {
    return Object.values(this.positions).filter(p => p.status === 'OPEN');
  }

  /**
   * Reset for new session
   */
  reset(initialBalance = 10000) {
    this.balance = initialBalance;
    this.positions = {};
    this.trades = [];
    this.contractCounter = 0;
  }
}

module.exports = PaperExchange;
