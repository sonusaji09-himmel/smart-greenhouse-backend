using Microsoft.AspNetCore.Mvc;
using SmartGreenhouse.API.DTOs;
using SmartGreenhouse.API.Services;

namespace SmartGreenhouse.API.Controllers;

[ApiController]
[Route("api/sensors")]
public class SensorController : ControllerBase
{
    private readonly SensorService _sensorService;

    public SensorController(SensorService sensorService)
    {
        _sensorService = sensorService;
    }

    /// <summary>
    /// Called by the ESP32 every ~30 seconds to submit a sensor reading.
    /// POST /api/sensors/data
    /// </summary>
    [HttpPost("data")]
    public async Task<IActionResult> IngestData([FromBody] SensorReadingInputDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        await _sensorService.IngestReadingAsync(dto);

        return Ok(new { message = "Data received successfully." });
    }
}
