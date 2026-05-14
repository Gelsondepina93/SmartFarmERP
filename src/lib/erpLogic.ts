import { EggProduction, ChickenLot, Silo, FeedConsumption, WeightRecord } from '../types';

/**
 * Calculates egg production metrics
 */
export const calculateEggMetrics = (prod: Partial<EggProduction>, lot?: ChickenLot) => {
  const total = prod.total_eggs || 0;
  const good = prod.good_eggs || 0;
  const broken = prod.broken_eggs || 0;
  const mortality = prod.mortality || 0;

  const qualityRate = total > 0 ? (good / total) * 100 : 100;
  const birds = lot?.current_quantity || 1;
  const eggsPerChicken = good / birds;
  const hdep = (good / birds) * 100; // Hen-Day Egg Production % based on good eggs as requested
  const mortalityRate = birds > 0 ? (mortality / birds) * 100 : 0;

  return {
    egg_quality_rate: Number(qualityRate.toFixed(2)),
    eggs_per_chicken: Number(eggsPerChicken.toFixed(3)),
    hdep: Number(hdep.toFixed(2)),
    lay_percentage: Number(hdep.toFixed(2)),
    mortality_rate: Number(mortalityRate.toFixed(2))
  };
};

/**
 * Calculates broiler performance metrics
 */
export const calculateBroilerMetrics = (record: Partial<WeightRecord>, previousRecord?: WeightRecord) => {
  const weight = record.average_weight || 0;
  const prevWeight = previousRecord?.average_weight || 0;
  const gain = prevWeight > 0 ? weight - prevWeight : 0;
  
  // FCR = Total Feed / Total Weight Gain
  // For a single day/record, we might have feed consumed and current average weight
  // But true FCR is cumulative. 
  // Simplified for daily check:
  const feed = record.feed_consumed || 0;
  const sampleSize = record.sample_size || 1;
  const totalGainForSample = gain * sampleSize;
  const fcr = totalGainForSample > 0 ? feed / (totalGainForSample / 1000) : 0; // feed in kg, gain in grams -> convert to kg

  return {
    weight_gain: gain,
    fcr: Number(fcr.toFixed(2))
  };
};

/**
 * Calculates cumulative FCR for a lot
 */
export const calculateCumulativePerformance = (weightHistory: WeightRecord[], initialQuantity: number) => {
  if (weightHistory.length === 0) return { fcr: 0, total_gain: 0, survivability: 100 };

  const sortedHistory = [...weightHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestWeight = sortedHistory[sortedHistory.length - 1].average_weight;
  
  const totalFeed = sortedHistory.reduce((sum, r) => sum + (r.feed_consumed || 0), 0);
  const totalMortality = sortedHistory.reduce((sum, r) => sum + (r.mortality || 0), 0);
  
  const currentBirds = initialQuantity - totalMortality;
  const survivability = (currentBirds / initialQuantity) * 100;
  
  // Cumulative Gain = (Current Weight * Current Birds) - (Initial Weight * Initial Birds)
  // For simplicity, assuming initial weight is 40g (day old chick)
  const initialWeightTotal = initialQuantity * (40 / 1000); // in kg
  const currentWeightTotal = currentBirds * (latestWeight / 1000); // in kg
  const totalGain = currentWeightTotal - initialWeightTotal;
  
  const cumulativeFcr = totalGain > 0 ? totalFeed / totalGain : 0;

  return {
    fcr: Number(cumulativeFcr.toFixed(2)),
    total_gain: Number(totalGain.toFixed(2)),
    survivability: Number(survivability.toFixed(2))
  };
};

/**
 * Calculates silo metrics
 */
export const calculateSiloMetrics = (silo: Silo, recentConsumptions: FeedConsumption[]) => {
  if (recentConsumptions.length === 0) {
    return {
      daily_consumption_average: 0,
      remaining_feed_days: silo.current_stock > 0 ? Infinity : 0
    };
  }

  // Calculate daily average from recent logs (e.g., last 7 records)
  const totalConsumed = recentConsumptions.reduce((sum, c) => sum + c.quantity, 0);
  const avg = totalConsumed / recentConsumptions.length;
  
  const remainingDays = avg > 0 ? silo.current_stock / avg : (silo.current_stock > 0 ? Infinity : 0);

  return {
    daily_consumption_average: Number(avg.toFixed(2)),
    remaining_feed_days: Number(remainingDays.toFixed(1))
  };
};

/**
 * Calculates Cost per unit
 */
export const calculateCostPerUnit = (totalProduction: number, totalCost: number) => {
  if (totalProduction === 0) return 0;
  return Number((totalCost / totalProduction).toFixed(4));
};

/**
 * Validates production values including categories
 */
export const validateProduction = (total: number, good: number, broken: number, s: number = 0, xl: number = 0, dirty: number = 0) => {
  const sumOfParts = good + broken + s + xl + dirty;
  return sumOfParts === total;
};

/**
 * Calculates age in days from entry date
 */
export const calculateAgeDays = (entryDate: string | any) => {
  try {
    const entry = new Date(entryDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - entry.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
};
