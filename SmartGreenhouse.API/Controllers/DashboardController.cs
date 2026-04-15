using Microsoft.AspNetCore.Mvc;
using SmartGreenhouse.API.DTOs;
using SmartGreenhouse.API.Services;

namespace SmartGreenhouse.API.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly SensorService _sensorService;

    public DashboardController(SensorService sensorService)
    {
        _sensorService = sensorService;
    }

    /// <summary>
    /// Returns the latest sensor reading with a computed status per sensor.
    /// Called by React every ~10 seconds to refresh the dashboard.
    /// GET /api/dashboard/overview
    /// </summary>
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var latest = await _sensorService.GetLatestReadingAsync();

        if (latest is null)
            return Ok(new { message = "No sensor data available yet." });

        var overview = new DashboardOverviewDto
        {
            Temperature = new SensorSummaryDto
            {
                Value  = latest.Temperature,
                Unit   = "°C",
                Status = SensorStatusEvaluator.Evaluate(
                    latest.Temperature,
                    min: 10, optimalMin: 18, optimalMax: 28, max: 40)
            },
            Humidity = new SensorSummaryDto
            {
                Value  = latest.Humidity,
                Unit   = "%",
                Status = SensorStatusEvaluator.Evaluate(
                    latest.Humidity,
                    min: 20, optimalMin: 50, optimalMax: 75, max: 90)
            },
            SoilMoisture = new SensorSummaryDto
            {
                Value  = latest.SoilMoisture,
                Unit   = "%",
                Status = SensorStatusEvaluator.Evaluate(
                    latest.SoilMoisture,
                    min: 20, optimalMin: 40, optimalMax: 70, max: 90)
            },
            Light = new SensorSummaryDto
            {
                Value  = latest.LightLevel,
                Unit   = "lux",
                Status = SensorStatusEvaluator.Evaluate(
                    latest.LightLevel,
                    min: 200, optimalMin: 500, optimalMax: 2000, max: 5000)
            },
            LastUpdated = latest.RecordedAt
        };

        return Ok(overview);
    }
}
