using System.ComponentModel.DataAnnotations;

namespace SmartGreenhouse.API.DTOs;

public class SensorReadingInputDto
{
    [Required]
    [Range(-50, 100, ErrorMessage = "Temperature must be between -50 and 100 °C.")]
    public double Temperature { get; set; }

    [Required]
    [Range(0, 100, ErrorMessage = "Humidity must be between 0 and 100 %.")]
    public double Humidity { get; set; }

    [Required]
    [Range(0, 100, ErrorMessage = "Soil moisture must be between 0 and 100 %.")]
    public double SoilMoisture { get; set; }

    [Required]
    [Range(0, 100_000, ErrorMessage = "Light level must be between 0 and 100,000 lux.")]
    public double LightLevel { get; set; }

    /// <summary>
    /// Optional. If omitted, the backend uses the current UTC time.
    /// </summary>
    public DateTime? Timestamp { get; set; }
}
