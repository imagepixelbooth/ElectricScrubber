const express = require('express');
const app = express();
const { resolve } = require('path');
// Replace if using a .env file
const env = require('dotenv').config({ path: './.env' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(express.static('.'));
app.use(express.json());

const cors = require('cors');
app.use(cors()); // Enable CORS for local testing

app.get('/config', (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { items, currency } = req.body;

    // Calculate total on the server to prevent manipulation
    // Now accepts state for tax calculation
    const calculateOrderAmount = (items, state) => {
      let amount = 0;
      items.forEach(item => {
        amount += (item.price * 100) * item.quantity;
      });

      // Shipping is now always free
      // if (amount < 3500 && amount > 0) amount += 499;

      // Add Tax (NJ Only: 6.625%)
      if (state && (state.toLowerCase() === 'nj' || state.toLowerCase() === 'new jersey')) {
        amount += Math.round(amount * 0.06625);
      }
      // Else 0 tax

      return Math.round(amount);
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: calculateOrderAmount(items, null), // Initial load has no state usually, or pass it if you have it
      currency: currency || 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id // Send ID back so frontend can update it later
    });
  } catch (e) {
    res.status(400).send({
      error: {
        message: e.message,
      },
    });
  }
});

// Endpoint to update amount when state changes
app.post('/update-payment-intent', async (req, res) => {
  try {
    const { paymentIntentId, items, state } = req.body;

    const calculateOrderAmount = (items, state) => {
      let amount = 0;
      items.forEach(item => {
        amount += (item.price * 100) * item.quantity;
      });

      // Shipping is now always free
      // if (amount < 3500 && amount > 0) amount += 499;

      // Tax Logic
      let tax = 0;
      if (state && (state.toLowerCase() === 'nj' || state.toLowerCase() === 'new jersey')) {
        tax = Math.round(amount * 0.06625);
      }

      return { total: Math.round(amount + tax), tax: tax };
    };

    const { total, tax } = calculateOrderAmount(items, state);

    // Update Stripe PaymentIntent
    await stripe.paymentIntents.update(paymentIntentId, {
      amount: total
    });

    res.send({
      amount: total,
      tax: tax
    });
  } catch (e) {
    res.status(400).send({ error: { message: e.message } });
  }
});

app.listen(4242, () => console.log('Node server listening on port 4242! on http://localhost:4242'));
