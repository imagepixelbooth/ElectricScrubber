const express = require('express');
const app = express();
const { resolve } = require('path');
// Replace if using a .env file
const env = require('dotenv').config({ path: './.env' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(express.static('.', { extensions: ['html'] }));
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
    // Now accepts state for tax calculation and promoCode for discounts
    const calculateOrderAmount = (items, state, promoCode) => {
      let amount = 0;
      items.forEach(item => {
        amount += (item.price * 100) * item.quantity;
      });

      // Shipping is now always free
      // if (amount < 3500 && amount > 0) amount += 499;

      // Apply Discounts
      if (promoCode === 'FAVORITE99') {
        amount = Math.round(amount * 0.01); // 99% OFF
      } else if (promoCode === 'VIRAL10') {
        amount = Math.round(amount * 0.90); // 10% OFF
      }

      // Add Tax (NJ Only: 6.625%)
      if (state && (state.toLowerCase() === 'nj' || state.toLowerCase() === 'new jersey')) {
        amount += Math.round(amount * 0.06625);
      }
      // Else 0 tax

      return Math.round(amount);
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: calculateOrderAmount(items, null, req.body.promoCode), // Initial load has no state usually, or pass it if you have it
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
    const { paymentIntentId, items, state, promoCode } = req.body;

    const calculateOrderAmount = (items, state, promoCode) => {
      let amount = 0;
      items.forEach(item => {
        amount += (item.price * 100) * item.quantity;
      });

      // Shipping is now always free
      // if (amount < 3500 && amount > 0) amount += 499;

      // Apply Discounts
      if (promoCode === 'FAVORITE99') {
        amount = Math.round(amount * 0.01); // 99% OFF
      } else if (promoCode === 'VIRAL10') {
        amount = Math.round(amount * 0.90); // 10% OFF
      }

      // Tax Logic
      let tax = 0;
      if (state && (state.toLowerCase() === 'nj' || state.toLowerCase() === 'new jersey')) {
        tax = Math.round(amount * 0.06625);
      }

      return { total: Math.round(amount + tax), tax: tax };
    };

    const { total, tax } = calculateOrderAmount(items, state, promoCode);

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

// Import the Order Handler
const createOrder = require('./api/create-order');
app.post('/api/create-order', createOrder);

app.listen(4242, () => console.log('Node server listening on port 4242! on http://localhost:4242'));
