const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectToMongoDB = require('./mongo');
const client = require('./twilio');

const app = express();
const port = process.env.PORT || 3000;  // Use dynamic port for Render deployment

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const sendSms = (phone, message) => {
    client.messages
        .create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER, // Use the Twilio phone number from environment variable
            to: phone,
        })
        .then(message => console.log(`SMS sent: ${message.sid}`))
        .catch(error => console.error('Error sending SMS:', error));
};

// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password, type } = req.body;

    try {
        const { usersCollection } = await connectToMongoDB();
        const user = await usersCollection.findOne({ email });
        if (user && password === user.password && type === user.type) {
            const { class: userClass } = user; // Get the teacher's class from the user object
            res.status(200).json({ ...user, class: userClass }); // Include class in response
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch student data by email
app.get('/studentData', async (req, res) => {
    const { email } = req.query;

    try {
        const { usersCollection } = await connectToMongoDB();
        const student = await usersCollection.findOne({ email });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.status(200).json({
            name: student.name,
            rollno: student.rollno,
            class: student.class,
            email: student.email // Include email in response
        });
    } catch (error) {
        console.error('Error fetching student data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/applyLeave', async (req, res) => {
    const { name, rollNumber, studentClass, leaveDescription, leaveDays, email, department } = req.body;

    try {
        const { leaveCollection, usersCollection } = await connectToMongoDB();

        // Fetch student details to get the phone number
        const student = await usersCollection.findOne({ email });
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Prepare leave application
        const leaveApplication = {
            name,
            rollNumber,
            class: studentClass,
            email,
            leaveDescription,
            leaveDays,
            department,
            status: 'Pending',
            appliedDate: new Date(),
        };

        // Insert leave application into the collection
        await leaveCollection.insertOne(leaveApplication);

        // Send SMS notification to the student
        const smsMessage = `Dear ${name}, your leave request has been submitted successfully.`;
        sendSms(student.phone, smsMessage);

        res.status(200).json({ message: 'Leave applied successfully' });
    } catch (error) {
        console.error('Error applying leave:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get leave requests by student email
app.get('/studentLeaveRequests', async (req, res) => {
    const { email } = req.query;

    try {
        const { leaveCollection } = await connectToMongoDB();
        const leaveRequests = await leaveCollection.find({ email }).sort({ appliedDate: -1 }).toArray();
        res.status(200).json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get leave history
app.get('/leaveHistory', async (req, res) => {
    const { email } = req.query;

    try {
        const { leaveCollection } = await connectToMongoDB();
        const leaveHistory = await leaveCollection.find({ email }).toArray();
        res.status(200).json(leaveHistory);
    } catch (error) {
        console.error('Error fetching leave history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// View leave requests for Teacher
app.get('/viewLeaveRequests', async (req, res) => {
    const { class: teacherClass } = req.query;

    try {
        const { leaveCollection } = await connectToMongoDB();
        const leaveRequests = await leaveCollection.find({ class: teacherClass, status: 'Pending' }).toArray();
        console.log(`Fetched leave requests for class ${teacherClass}:`, leaveRequests); 
        res.status(200).json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Error fetching leave requests.' });
    }
});

// Route to update leave request status for Teacher
app.post('/updateLeaveRequest', async (req, res) => {
    const { requestId, action } = req.body;

    try {
        const { leaveCollection, usersCollection } = await connectToMongoDB();

        const updateResult = await leaveCollection.updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: action } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }

        // After updating, send a notification to the student
        const leaveRequest = await leaveCollection.findOne({ _id: new ObjectId(requestId) });
        const student = await usersCollection.findOne({ email: leaveRequest.email });

        if (student) {
            let smsMessage;
            if (action === 'accept') {
                smsMessage = 'Your leave request has been approved by the teacher.';
            } else if (action === 'reject') {
                smsMessage = 'Your leave request has been rejected by the teacher.';
            } else if (action === 'forward') {
                smsMessage = 'Your leave request has been forwarded to the HOD.';
            }

            sendSms(student.phone, smsMessage); 
        }

        res.json({ message: 'Leave request updated successfully.' });
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Error updating leave request.' });
    }
});

// Similarly, update the HOD update endpoint
app.post('/hod/updateLeaveRequest', async (req, res) => {
    const { requestId, action } = req.body;

    try {
        const { leaveCollection, usersCollection } = await connectToMongoDB();

        const updateResult = await leaveCollection.updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: action } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }

        // After updating, send a notification to the student
        const leaveRequest = await leaveCollection.findOne({ _id: new ObjectId(requestId) });
        const student = await usersCollection.findOne({ email: leaveRequest.email });

        if (student) {
            let smsMessage;
            if (action === 'acceptedbyhod') {
                smsMessage = 'Your leave request has been approved by the HOD.';
            } else if (action === 'rejectedbyhod') {
                smsMessage = 'Your leave request has been rejected by the HOD.';
            }

            sendSms(student.phone, smsMessage);
        }

        res.json({ message: 'Leave request updated successfully.' });
    } catch (error) {
        console.error('Error updating leave request for HOD:', error);
        res.status(500).json({ message: 'Error updating leave request.' });
    }
});

// View leave requests for HOD
app.get('/hod/viewLeaveRequests', async (req, res) => {
    try {
        const { leaveCollection } = await connectToMongoDB();
        const leaveRequests = await leaveCollection.find({ status: 'forward' }).toArray();
        res.status(200).json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests for HOD:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch leave requests with status 'acceptedbyhod' or 'rejectedbyhod' for HOD
app.get('/hod/leaveHistory', async (req, res) => {
    try {
        const { leaveCollection } = await connectToMongoDB();
        const leaveRequests = await leaveCollection.find({
            status: { $in: ['acceptedbyhod', 'rejectedbyhod'] }
        }).toArray();

        res.status(200).json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search for student by roll number
app.get('/searchStudent', async (req, res) => {
    const { rollNumber } = req.query;

    try {
        const { usersCollection } = await connectToMongoDB();
        const student = await usersCollection.findOne({ rollno: rollNumber });

        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Fetch teacher data by email
app.get('/teacherData', async (req, res) => {
    const { email } = req.query;

    try {
        const { usersCollection } = await connectToMongoDB();
        const teacher = await usersCollection.findOne({ email });

        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        res.status(200).json(teacher);
    } catch (error) {
        console.error('Error fetching teacher data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
