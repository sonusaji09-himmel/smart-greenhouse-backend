using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartGreenhouse.API.Models;

public class SensorReading
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("deviceId")]
    public string DeviceId { get; set; } = "esp32-01";

    [BsonElement("temperature")]
    public double Temperature { get; set; }

    [BsonElement("humidity")]
    public double Humidity { get; set; }

    [BsonElement("soilMoisture")]
    public double SoilMoisture { get; set; }

    [BsonElement("lightLevel")]
    public double LightLevel { get; set; }

    [BsonElement("recordedAt")]
    public DateTime RecordedAt { get; set; }
}
