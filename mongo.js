const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGO_URI; // Use Mongo URI from environment variable
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('Project');
        return {
            usersCollection: db.collection('Registrations'),
            leaveCollection: db.collection('LeaveRequests'),
        };
    } catch (err) {
        console.error(err);
    }
}

module.exports = connectToMongoDB;
