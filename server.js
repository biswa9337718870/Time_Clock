const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, 'database.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Time_Clock_HR:OWE5054P@timeclock.daps9qi.mongodb.net/time_clock?appName=TimeClock';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static frontend files
app.use(express.static(__dirname));

const LIST_COLLECTIONS = ['employees', 'attendance', 'leaves', 'holidays', 'payrolls', 'notifications', 'emails', 'outside_work', 'tasks', 'audit_logs'];

let db;
let client;

async function initMongo() {
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    db = client.db('time_clock');
    console.log("Connected to MongoDB successfully!");
    
    // Seed database if empty
    await seedDatabase();
  } catch (err) {
    console.error("CRITICAL: Could not connect to MongoDB:", err);
    console.log("Please make sure MongoDB is running or configure MONGODB_URI in your environment variables.");
  }
}

async function seedDatabase() {
  try {
    const empCount = await db.collection('employees').countDocuments({});
    if (empCount === 0) {
      console.log("MongoDB collection 'employees' is empty. Attempting to seed from database.json...");
      if (fs.existsSync(DB_FILE)) {
        const seedData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (seedData && typeof seedData === 'object') {
          for (const key of LIST_COLLECTIONS) {
            if (seedData[key] && Array.isArray(seedData[key]) && seedData[key].length > 0) {
              await db.collection(key).deleteMany({});
              await db.collection(key).insertMany(seedData[key]);
              console.log(`Seeded collection '${key}' with ${seedData[key].length} documents.`);
            }
          }
          
          if (seedData.geofence) {
            await db.collection('settings').replaceOne({ key: 'geofence' }, { key: 'geofence', value: seedData.geofence }, { upsert: true });
            console.log("Seeded 'geofence' setting.");
          }
          if (seedData.booted !== undefined) {
            await db.collection('settings').replaceOne({ key: 'booted' }, { key: 'booted', value: seedData.booted }, { upsert: true });
            console.log("Seeded 'booted' setting.");
          }
          console.log("MongoDB database seeding finished.");
        }
      } else {
        console.log(`No ${DB_FILE} found to seed database. Starting empty.`);
      }
    } else {
      console.log("MongoDB database is already seeded (employees found).");
    }
  } catch (err) {
    console.error("Error during database seeding:", err);
  }
}

// API Routes
app.get('/api/data', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ status: "error", message: "Database connection not available" });
    }
    const payload = {};
    for (const col of LIST_COLLECTIONS) {
      payload[col] = await db.collection(col).find({}, { projection: { _id: 0 } }).toArray();
    }
    
    const geofenceDoc = await db.collection('settings').findOne({ key: 'geofence' }, { projection: { _id: 0 } });
    payload.geofence = geofenceDoc ? geofenceDoc.value : { lat: null, lng: null, radius: 200 };
    
    const bootedDoc = await db.collection('settings').findOne({ key: 'booted' }, { projection: { _id: 0 } });
    payload.booted = bootedDoc ? bootedDoc.value : false;
    
    res.json(payload);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post('/api/save', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ status: "error", message: "Database connection not available" });
    }
    const payload = req.body;
    
    for (const key of Object.keys(payload)) {
      if (LIST_COLLECTIONS.includes(key)) {
        const val = payload[key];
        if (Array.isArray(val)) {
          await db.collection(key).deleteMany({});
          if (val.length > 0) {
            await db.collection(key).insertMany(val);
          }
        }
      } else if (['geofence', 'booted'].includes(key)) {
        await db.collection('settings').replaceOne({ key: key }, { key: key, value: payload[key] }, { upsert: true });
      }
    }
    
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Catch-all route to serve index.html for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Time Clock Database & Web Server running at http://localhost:${PORT}`);
  initMongo();
});
