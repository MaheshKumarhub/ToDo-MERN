const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newline characters
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    })
  });
// Create an instance of express
const app = express();
app.use(express.json());
app.use(cors());

// Connecting MongoDB
const url = process.env.MONGO_URI;
mongoose.connect(url)
  .then(() => {
    console.log('DB Connected');
  })
  .catch((err) => {
    console.log(err);
  });

// Creating schema
const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  userId: { type: String, required: true }, // User ID from Firebase
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Creating model
const Todo = mongoose.model('Todo', todoSchema);

// Middleware to authenticate and extract user ID
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log("Received Token:", token);

  if (!token) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Attach the decoded token to the request object
    next();
  } catch (error) {
    console.log("Token verification error:", error); // Log error details
    res.status(401).send('Unauthorized');
  }
};

// Apply the authentication middleware
app.use(authenticateUser);

// Routes
// Create a new todo item
app.post('/todos', async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.uid;

  try {
    const newTodo = new Todo({
      title,
      description,
      userId,
    });
    await newTodo.save();
    res.status(201).json(newTodo);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

// Get all items for a specific user
app.get('/todos', async (req, res) => {
  try {
    const userId = req.user.uid; // Using the middleware that provides the UID
    const todos = await Todo.find({ userId });
    res.json(todos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

// Update a todo item
app.put('/todos/:id', async (req, res) => {
  try {
    const { title, description } = req.body;
    const id = req.params.id;
    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      { title, description },
      { new: true }
    );

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    res.json(updatedTodo);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a todo item
app.delete('/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await Todo.findByIdAndDelete(id);
    res.status(204).end();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});


// Start the server
const port = 3000;
app.listen(port, () => {
  console.log('Server listening on port ' + port);
});
