// twilio.js
const twilio = require('twilio');

const accountSid = 'ACa71e57ba82e2ed78ba07e4ad7d1e04e8'; // Replace with your Twilio account SID
const authToken = 'f8491c5b457816f93e5a52dbffae8681'; // Replace with your Twilio auth token
const client = twilio(accountSid, authToken);

module.exports = client;
