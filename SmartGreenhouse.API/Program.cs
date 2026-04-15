using SmartGreenhouse.API.Data;
using SmartGreenhouse.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── MongoDB ──────────────────────────────────────────────────────────────────
var mongoSettings = builder.Configuration
    .GetSection("MongoDB")
    .Get<MongoDbSettings>()
    ?? throw new InvalidOperationException(
        "MongoDB configuration section is missing from appsettings.json.");

builder.Services.AddSingleton(mongoSettings);
builder.Services.AddSingleton<MongoDbContext>();

// ── Services ─────────────────────────────────────────────────────────────────
builder.Services.AddScoped<SensorService>();

// ── Controllers ──────────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ── CORS (React dev servers on :3000 and :5173) ───────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy
            .WithOrigins("http://localhost:3000", "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();

app.UseCors("AllowReact");
app.MapControllers();

app.Run();
