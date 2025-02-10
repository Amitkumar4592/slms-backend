const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID; // Use Twilio Account SID from environment variable
const authToken = process.env.TWILIO_AUTH_TOKEN; // Use Twilio Auth Token from environment variable
const client = twilio(accountSid, authToken);

module.exports = client;
