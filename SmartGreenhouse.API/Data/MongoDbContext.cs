using MongoDB.Driver;
using SmartGreenhouse.API.Models;

namespace SmartGreenhouse.API.Data;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(MongoDbSettings settings)
    {
        var client = new MongoClient(settings.ConnectionString);
        _database  = client.GetDatabase(settings.DatabaseName);

        EnsureIndexes();
    }

    public IMongoCollection<SensorReading> SensorReadings =>
        _database.GetCollection<SensorReading>("sensor_data");

    /// <summary>
    /// Creates a compound descending index on (deviceId, recordedAt) so that
    /// latest-reading queries and time-range scans are fast from day one.
    /// </summary>
    private void EnsureIndexes()
    {
        var indexKeys = Builders<SensorReading>.IndexKeys
            .Ascending(r => r.DeviceId)
            .Descending(r => r.RecordedAt);

        var indexModel = new CreateIndexModel<SensorReading>(
            indexKeys,
            new CreateIndexOptions { Name = "deviceId_recordedAt" }
        );

        SensorReadings.Indexes.CreateOne(indexModel);
    }
}
