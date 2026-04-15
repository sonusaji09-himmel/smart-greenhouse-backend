namespace SmartGreenhouse.API.DTOs;

public class DashboardOverviewDto
{
    public SensorSummaryDto Temperature { get; set; } = null!;
    public SensorSummaryDto Humidity    { get; set; } = null!;
    public SensorSummaryDto SoilMoisture { get; set; } = null!;
    public SensorSummaryDto Light        { get; set; } = null!;
    public DateTime LastUpdated { get; set; }
}

public class SensorSummaryDto
{
    public double Value  { get; set; }
    public string Unit   { get; set; } = string.Empty;

    /// <summary>optimal | warning | critical</summary>
    public string Status { get; set; } = string.Empty;
}
