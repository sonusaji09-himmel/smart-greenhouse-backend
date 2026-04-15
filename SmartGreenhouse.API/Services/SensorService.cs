using MongoDB.Driver;
using SmartGreenhouse.API.Data;
using SmartGreenhouse.API.DTOs;
using SmartGreenhouse.API.Models;

namespace SmartGreenhouse.API.Services;

public class SensorService
{
    private readonly MongoDbContext _context;

    public SensorService(MongoDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Maps the inbound DTO to a SensorReading document and persists it.
    /// </summary>
    public async Task IngestReadingAsync(SensorReadingInputDto dto)
    {
        var reading = new SensorReading
        {
            Temperature  = dto.Temperature,
            Humidity     = dto.Humidity,
            SoilMoisture = dto.SoilMoisture,
            LightLevel   = dto.LightLevel,
            RecordedAt   = dto.Timestamp.HasValue
                               ? dto.Timestamp.Value.ToUniversalTime()
                               : DateTime.UtcNow
        };

        await _context.SensorReadings.InsertOneAsync(reading);
    }

    /// <summary>
    /// Returns the single most recent document from sensor_data.
    /// The compound index on (deviceId, recordedAt DESC) makes this O(1).
    /// </summary>
    public async Task<SensorReading?> GetLatestReadingAsync()
    {
        return await _context.SensorReadings
            .Find(_ => true)
            .SortByDescending(r => r.RecordedAt)
            .FirstOrDefaultAsync();
    }
}
