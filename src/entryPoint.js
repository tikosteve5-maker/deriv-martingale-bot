/**
 * Entry Point Analyzer
 * 
 * Analyzes recent digit patterns to determine if trading conditions are met
 * before placing a contract.
 * 
 * ENTRY POINT LOGIC:
 * 1. Collect recent completed digits
 * 2. Analyze Over/Under conditions vs. barrier
 * 3. Calculate frequency of qualifying digits
 * 4. Verify minimum requirements are met
 * 5. Return TRUE/FALSE entry decision
 */

class EntryPoint {
  constructor(config) {
    this.sampleSize = parseInt(config.sample_size);
    this.barrier = parseFloat(config.barrier);
    this.minFrequency = parseFloat(config.min_frequency); // percentage
    this.confirmationType = config.confirmation_type; // 'frequency', 'consecutive', 'recent'
    this.recentDigitConfirmation = config.recent_digit_confirmation === 'true' || config.recent_digit_confirmation === true;
    this.contractType = config.contract_type; // 'DIGITOVER' or 'DIGITUNDER'
    
    this.digitHistory = [];
    this.lastAnalysis = null;
  }

  /**
   * Add a completed digit to history
   */
  addDigit(digit) {
    this.digitHistory.push(parseInt(digit));
    
    // Keep only the last sampleSize digits
    if (this.digitHistory.length > this.sampleSize) {
      this.digitHistory.shift();
    }
  }

  /**
   * Get digits that match the barrier condition
   * For DIGITOVER (barrier=5): qualifying digits are 6,7,8,9
   * For DIGITUNDER (barrier=5): qualifying digits are 0,1,2,3,4
   */
  getQualifyingDigits() {
    if (this.contractType === 'DIGITOVER') {
      // Over: digits strictly greater than barrier
      return this.digitHistory.filter(d => d > this.barrier);
    } else {
      // Under: digits strictly less than barrier
      return this.digitHistory.filter(d => d < this.barrier);
    }
  }

  /**
   * Calculate frequency of qualifying digits
   */
  calculateFrequency() {
    if (this.digitHistory.length === 0) return 0;
    
    const qualifying = this.getQualifyingDigits();
    return (qualifying.length / this.digitHistory.length) * 100;
  }

  /**
   * Check if recent digit(s) confirm the entry condition
   */
  checkRecentDigitConfirmation() {
    if (!this.recentDigitConfirmation || this.digitHistory.length === 0) {
      return true;
    }
    
    const lastDigit = this.digitHistory[this.digitHistory.length - 1];
    
    if (this.contractType === 'DIGITOVER') {
      return lastDigit > this.barrier;
    } else {
      return lastDigit < this.barrier;
    }
  }

  /**
   * Analyze entry conditions
   * Returns: { entryAllowed: boolean, details: {...} }
   */
  analyze() {
    const analysis = {
      timestamp: new Date().toISOString(),
      digitCount: this.digitHistory.length,
      digits: [...this.digitHistory],
      barrier: this.barrier,
      contractType: this.contractType,
      entryAllowed: false,
      reason: '',
      details: {}
    };

    // Check: Do we have enough digit history?
    if (this.digitHistory.length < this.sampleSize) {
      analysis.reason = `INSUFFICIENT_HISTORY: need ${this.sampleSize}, have ${this.digitHistory.length}`;
      analysis.details.historySufficient = false;
      this.lastAnalysis = analysis;
      return analysis;
    }

    analysis.details.historySufficient = true;

    // Calculate frequency
    const frequency = this.calculateFrequency();
    analysis.details.frequency = frequency;
    analysis.details.minFrequency = this.minFrequency;
    analysis.details.frequencySufficient = frequency >= this.minFrequency;

    // Check frequency
    if (frequency < this.minFrequency) {
      analysis.reason = `FREQUENCY_TOO_LOW: ${frequency.toFixed(2)}% < ${this.minFrequency}%`;
      this.lastAnalysis = analysis;
      return analysis;
    }

    // Check recent digit confirmation if enabled
    const recentOK = this.checkRecentDigitConfirmation();
    analysis.details.recentDigitOK = recentOK;

    if (this.recentDigitConfirmation && !recentOK) {
      analysis.reason = 'RECENT_DIGIT_MISMATCH: last digit does not confirm pattern';
      this.lastAnalysis = analysis;
      return analysis;
    }

    // All checks passed!
    analysis.entryAllowed = true;
    analysis.reason = 'ENTRY_CONDITIONS_MET';
    this.lastAnalysis = analysis;
    return analysis;
  }

  /**
   * Get the last analysis
   */
  getLastAnalysis() {
    return this.lastAnalysis;
  }

  /**
   * Reset history (new trading cycle)
   */
  reset() {
    this.digitHistory = [];
    this.lastAnalysis = null;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      digitHistory: [...this.digitHistory],
      lastAnalysis: this.lastAnalysis
    };
  }
}

module.exports = EntryPoint;
