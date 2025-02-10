const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb://localhost:27017/slms';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('Project');
        return {
            usersCollection: db.collection('Registrations'),
            leaveCollection: db.collection('LeaveRequests'), // New collection for leave requests
        };
    } catch (err) {
        console.error(err);
    }
}

module.exports = connectToMongoDB;
