/**
 * Deriv API Client
 * Handles WebSocket connection and API calls to Deriv
 */

const WebSocket = require('ws');

class DerivClient {
  constructor(config) {
    this.appId = config.appId;
    this.apiToken = config.apiToken;
    this.currency = config.currency || 'USD';
    this.isPaper = config.paper !== false; // default to paper mode
    this.ws = null;
    this.messageId = 0;
    this.callbacks = {};
    this.tickHistory = {};
  }

  /**
   * Connect to Deriv WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      const url = 'wss://ws.derivws.com/websockets/v3';
      
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[DERIV] Connected to WebSocket');
        this.authorize().then(resolve).catch(reject);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        console.error('[DERIV] WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[DERIV] WebSocket closed');
      });
    });
  }

  /**
   * Send API request
   */
  sendRequest(request) {
    return new Promise((resolve, reject) => {
      const msgId = ++this.messageId;
      request.req_id = msgId;

      this.callbacks[msgId] = (response) => {
        if (response.error) {
          reject(new Error(`API Error: ${response.error.message}`));
        } else {
          resolve(response);
        }
      };

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const response = JSON.parse(data);
      
      // Handle callback responses
      if (response.req_id && this.callbacks[response.req_id]) {
        const callback = this.callbacks[response.req_id];
        delete this.callbacks[response.req_id];
        callback(response);
      }

      // Handle tick updates
      if (response.tick) {
        this.handleTick(response.tick);
      }
    } catch (error) {
      console.error('[DERIV] Error handling message:', error);
    }
  }

  /**
   * Handle incoming tick
   */
  handleTick(tick) {
    const symbol = tick.symbol;
    if (!this.tickHistory[symbol]) {
      this.tickHistory[symbol] = [];
    }
    this.tickHistory[symbol].push(tick);
  }

  /**
   * Authorize with API token
   */
  authorize() {
    const request = {
      authorize: this.apiToken
    };
    return this.sendRequest(request);
  }

  /**
   * Subscribe to ticks
   */
  subscribeTicks(symbol) {
    const request = {
      ticks: symbol,
      subscribe: 1
    };
    return this.sendRequest(request);
  }

  /**
   * Get tick stream (for paper mode simulation)
   */
  getTickHistory(symbol, limit = 10) {
    if (!this.tickHistory[symbol]) {
      return [];
    }
    return this.tickHistory[symbol].slice(-limit);
  }

  /**
   * Buy contract
   */
  buyContract(contractParams) {
    const request = {
      buy: 1,
      price: contractParams.stake,
      parameters: {
        amount: contractParams.stake,
        basis: 'stake',
        contract_type: contractParams.contractType, // DIGITOVER, DIGITUNDER
        currency: this.currency,
        duration: contractParams.duration,
        duration_unit: contractParams.duration_unit || 't',
        symbol: contractParams.symbol,
        barrier: contractParams.barrier
      }
    };
    return this.sendRequest(request);
  }

  /**
   * Sell contract (close position)
   */
  sellContract(contractId, price) {
    const request = {
      sell: contractId,
      price: price
    };
    return this.sendRequest(request);
  }

  /**
   * Get contract details
   */
  getContractDetails(contractId) {
    const request = {
      proposal_open_contract: 1,
      contract_id: contractId
    };
    return this.sendRequest(request);
  }

  /**
   * Disconnect
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      resolve();
    });
  }
}

module.exports = DerivClient;
