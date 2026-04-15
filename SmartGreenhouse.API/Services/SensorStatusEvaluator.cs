namespace SmartGreenhouse.API.Services;

/// <summary>
/// Pure static helper that maps a sensor value to a status string using
/// hardcoded thresholds. Thresholds will move to a DB-backed service later.
/// </summary>
public static class SensorStatusEvaluator
{
    /// <param name="value">Raw sensor reading.</param>
    /// <param name="min">Below this → critical.</param>
    /// <param name="optimalMin">Below this (but above min) → warning.</param>
    /// <param name="optimalMax">Above this (but below max) → warning.</param>
    /// <param name="max">Above this → critical.</param>
    /// <returns>"optimal" | "warning" | "critical"</returns>
    public static string Evaluate(
        double value,
        double min, double optimalMin,
        double optimalMax, double max)
    {
        if (value < min || value > max)
            return "critical";

        if (value < optimalMin || value > optimalMax)
            return "warning";

        return "optimal";
    }
}
